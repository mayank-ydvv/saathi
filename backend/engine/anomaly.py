"""Anomaly detection: late start, long inactivity, night activity (contract 4.3).

Pure functions, no I/O. Each kind fires at most once per local day (per zone for
late_start / night_activity, per home for long_inactivity), remembered in `Routine.fired`
as kind -> local ISO date. The functions write that marker, so callers must persist the
routine after a check that returned an anomaly.

Rules, one sentence each:
- late_start: no kitchen / bedroom activity today by usual first time + max(3 x MAD, 30 min).
  Cold start (< 5 days learned): kitchen only, against 08:00 + 30 min.
- long_inactivity: during waking hours, no movement anywhere for 4 h, counting the night's
  sleep only from waking_start (so the morning after a normal night never fires).
- night_activity: front door / kitchen activity outside waking hours in a slot that was
  active on < 5% of learned days.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from backend.engine.models import Anomaly, EngineConfig, Event, Routine
from backend.engine.routine import ACTIVITY_TYPES, SLOT_MINUTES, TIMEZONE

NIGHT_ZONES = frozenset({"front_door", "kitchen"})
# Only these zones say "the day started". A late front door or living room is a normal day
# (no milk run, reading in bed) and would bury the real alert behind a false one.
LATE_START_ZONES = frozenset({"kitchen", "bedroom"})
COLD_START_ZONE = "kitchen"


def check_event(r: Routine, e: Event, cfg: EngineConfig, tz: str = TIMEZONE) -> Anomaly | None:
    """night_activity for one incoming event, checked against history before it. O(1)."""
    if e.type not in ACTIVITY_TYPES or e.zone not in NIGHT_ZONES:
        return None
    if r.days_seen < cfg.min_days_for_checks:
        return None
    t = e.ts.astimezone(ZoneInfo(tz))
    minute = t.hour * 60 + t.minute
    if _waking(minute, cfg):
        return None
    slot = minute // SLOT_MINUTES
    if r.hist[slot] >= cfg.night_rare_ratio * r.days_seen:
        return None
    if not _claim(r, "night_activity", t.date()):
        return None
    what = (
        "Front door opened" if e.zone == "front_door" else f"{_label(e.zone).capitalize()} movement"
    )
    return Anomaly(
        home_id=e.home_id,
        kind="night_activity",
        zone=e.zone,
        reason=f"{what} at {_hhmm(minute)} — unusual for this hour",
        detected_at=e.ts,
        details={
            "event_id": e.event_id,
            "slot": slot,
            "slot_days": r.hist[slot],
            "days_seen": r.days_seen,
        },
    )


def check_tick(
    routines: dict[str, Routine], now: datetime, cfg: EngineConfig, tz: str = TIMEZONE
) -> list[Anomaly]:
    """late_start per zone + home-wide long_inactivity for one home. O(zones)."""
    t = now.astimezone(ZoneInfo(tz))
    today, minute = t.date(), t.hour * 60 + t.minute
    out = [a for r in routines.values() if (a := _late_start(r, now, today, minute, cfg))]
    if (a := _long_inactivity(routines, now, today, minute, cfg, tz)) is not None:
        out.append(a)
    return out


def _late_start(
    r: Routine, now: datetime, today: date, minute: int, cfg: EngineConfig
) -> Anomaly | None:
    if r.zone not in LATE_START_ZONES or (r.today == today and r.today_first is not None):
        return None
    if r.days_seen >= cfg.min_days_for_checks and r.median_first is not None:
        usual = r.median_first
        buffer = max(round(cfg.mad_multiplier * (r.mad_first or 0)), cfg.late_buffer_min_floor)
    elif r.zone == COLD_START_ZONE:
        usual, buffer = _minutes(cfg.default_first_activity), cfg.late_buffer_min_floor
    else:
        return None
    if minute <= usual + buffer or not _claim(r, "late_start", today):
        return None
    return Anomaly(
        home_id=r.home_id,
        kind="late_start",
        zone=r.zone,
        reason=f"No {_label(r.zone)} movement by {_hhmm(minute)} (usually {_hhmm(usual)})",
        detected_at=now,
        details={"usual_first": usual, "threshold": usual + buffer, "days_seen": r.days_seen},
    )


def _long_inactivity(
    routines: dict[str, Routine],
    now: datetime,
    today: date,
    minute: int,
    cfg: EngineConfig,
    tz: str,
) -> Anomaly | None:
    if not _waking(minute, cfg):
        return None
    last = max(
        (r for r in routines.values() if r.last_event_ts is not None),
        key=lambda r: r.last_event_ts,
        default=None,
    )
    if last is None:
        return None
    zinfo = ZoneInfo(tz)
    waking_start = datetime.combine(today, datetime.min.time(), zinfo) + timedelta(
        minutes=_minutes(cfg.waking_start)
    )
    idle = now - max(last.last_event_ts, waking_start)
    if idle <= timedelta(minutes=cfg.inactivity_minutes):
        return None
    if any(r.fired.get("long_inactivity") == today.isoformat() for r in routines.values()):
        return None
    for r in routines.values():
        r.fired["long_inactivity"] = today.isoformat()
    idle_min = int(idle.total_seconds() // 60)
    seen = last.last_event_ts.astimezone(zinfo)
    when = _hhmm(seen.hour * 60 + seen.minute)
    if seen.date() == today - timedelta(days=1):
        when += " yesterday"
    elif seen.date() != today:
        when += f" on {seen:%d %b}"
    return Anomaly(
        home_id=last.home_id,
        kind="long_inactivity",
        zone=None,
        reason=(
            f"No movement anywhere for {idle_min // 60} h {idle_min % 60} min "
            f"(last: {_label(last.zone)} at {when})"
        ),
        detected_at=now,
        details={"idle_minutes": idle_min, "last_zone": last.zone},
    )


def _claim(r: Routine, kind: str, day: date) -> bool:
    """Mark `kind` as fired on `day`; False if it already fired that day."""
    if r.fired.get(kind) == day.isoformat():
        return False
    r.fired[kind] = day.isoformat()
    return True


def _waking(minute: int, cfg: EngineConfig) -> bool:
    start, end = _minutes(cfg.waking_start), _minutes(cfg.waking_end)
    return start <= minute < end if start <= end else minute >= start or minute < end


def _minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _hhmm(minute: int) -> str:
    return f"{minute // 60:02d}:{minute % 60:02d}"


def _label(zone: str) -> str:
    return zone.replace("_", " ")
