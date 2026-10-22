"""Temporary stand-in for Krishnaditya's engine and digest (contract 4.3).

Same signatures, simple logic, so ingest, the scheduler and tests run before
`backend/engine/{routine,anomaly,backfill}.py` and `backend/digest/` are merged.
`backend/common/engine.py` prefers the real modules and falls back to this file.
Delete this file once the real engine is merged.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime, timedelta
from statistics import median

from backend.common.config import ENGINE_EVENT_TYPES, HISTORY_DAYS, SLOTS_PER_DAY, TIMEZONE
from backend.common.timeutil import hhmm, local, parse_hhmm, parse_iso, to_iso
from backend.engine.models import Anomaly, EngineConfig, Event, Routine

ZONE_LABELS = {
    "front_door": "front door",
    "kitchen": "kitchen",
    "living_room": "living room",
    "bedroom": "bedroom",
}


# routine.py ----------------------------------------------------------------
def new_routine(home_id: str, zone: str) -> Routine:
    return Routine(home_id, zone, [0] * SLOTS_PER_DAY, 0, [], None, None, None, None, None, set())


def update_on_event(r: Routine, e: Event, tz: str = TIMEZONE) -> Routine:
    """Fold one event into today's accumulators. O(1) (plus a rare day rollover)."""
    if e.type not in ENGINE_EVENT_TYPES:
        return r
    t = local(e.ts, tz)
    day, minute = t.date(), t.hour * 60 + t.minute
    if r.today is None:
        r.today = day
    elif day > r.today:
        rollover_day(r, day)
    if day == r.today:
        r.today_slots.add(minute // 15)
        r.today_first = minute if r.today_first is None else min(r.today_first, minute)
    if r.last_event_ts is None or e.ts > r.last_event_ts:
        r.last_event_ts = e.ts
    return r


def rollover_day(r: Routine, new_day: date) -> Routine:
    """Close the current day into hist / first_times and start `new_day`. O(D log D)."""
    if r.today is not None and new_day > r.today:
        for s in r.today_slots:
            r.hist[s] = min(r.hist[s] + 1, HISTORY_DAYS)
        if r.today_first is not None:
            r.first_times = (r.first_times + [r.today_first])[-HISTORY_DAYS:]
        r.days_seen = min(r.days_seen + 1, HISTORY_DAYS)
        if r.first_times:
            med = int(median(r.first_times))
            r.median_first = med
            r.mad_first = int(median(abs(x - med) for x in r.first_times))
    if r.today is None or new_day > r.today:
        r.today, r.today_first, r.today_slots = new_day, None, set()
    return r


def routine_to_dict(r: Routine) -> dict:
    return {
        "home_id": r.home_id,
        "zone": r.zone,
        "hist": list(r.hist),
        "days_seen": r.days_seen,
        "first_times": list(r.first_times),
        "median_first": r.median_first,
        "mad_first": r.mad_first,
        "last_event_ts": to_iso(r.last_event_ts) if r.last_event_ts else None,
        "today": r.today.isoformat() if r.today else None,
        "today_first": r.today_first,
        "today_slots": sorted(r.today_slots),
    }


def routine_from_dict(d: dict) -> Routine:
    return Routine(
        home_id=d["home_id"],
        zone=d["zone"],
        hist=[int(x) for x in d["hist"]],
        days_seen=int(d["days_seen"]),
        first_times=[int(x) for x in d.get("first_times", [])],
        median_first=d.get("median_first"),
        mad_first=d.get("mad_first"),
        last_event_ts=parse_iso(d["last_event_ts"]) if d.get("last_event_ts") else None,
        today=date.fromisoformat(d["today"]) if d.get("today") else None,
        today_first=d.get("today_first"),
        today_slots={int(x) for x in d.get("today_slots", [])},
    )


# anomaly.py ----------------------------------------------------------------
def _waking(minute: int, cfg: EngineConfig) -> bool:
    return parse_hhmm(cfg.waking_start) <= minute < parse_hhmm(cfg.waking_end)


def check_event(r: Routine, e: Event, cfg: EngineConfig, tz: str = TIMEZONE) -> Anomaly | None:
    """night_activity: an event outside waking hours in a slot active on < 5% of days. O(1)."""
    if e.type not in ENGINE_EVENT_TYPES:
        return None
    t = local(e.ts, tz)
    minute = t.hour * 60 + t.minute
    if _waking(minute, cfg):
        return None
    slot = minute // 15
    if r.days_seen >= cfg.min_days_for_checks:
        ratio = r.hist[slot] / r.days_seen
        if ratio >= cfg.night_rare_ratio:
            return None
    else:
        ratio = 0.0  # cold start: any night-time event is unusual
    label = ZONE_LABELS.get(e.zone, e.zone)
    what = "Front door opened" if e.zone == "front_door" else f"Movement in the {label}"
    return Anomaly(
        home_id=e.home_id,
        kind="night_activity",
        zone=e.zone,
        reason=f"{what} at {hhmm(minute)}",
        detected_at=e.ts,
        details={"slot": slot, "ratio": round(ratio, 3), "event_id": e.event_id},
    )


def check_tick(
    routines: dict[str, Routine], now: datetime, cfg: EngineConfig, tz: str = TIMEZONE
) -> list[Anomaly]:
    """late_start per zone + home-wide long_inactivity. O(zones)."""
    t = local(now, tz)
    today, minute = t.date(), t.hour * 60 + t.minute
    out: list[Anomaly] = []
    if not routines:
        return out
    home_id = next(iter(routines.values())).home_id
    for zone, r in routines.items():
        active_today = r.today == today and r.today_first is not None
        if active_today or len(r.first_times) < cfg.min_days_for_checks:
            continue
        usual = (
            r.median_first if r.median_first is not None else parse_hhmm(cfg.default_first_activity)
        )
        buffer = max(int(cfg.mad_multiplier * (r.mad_first or 0)), cfg.late_buffer_min_floor)
        if minute > usual + buffer:
            label = ZONE_LABELS.get(zone, zone)
            out.append(
                Anomaly(
                    home_id=home_id,
                    kind="late_start",
                    zone=zone,
                    reason=f"No {label} movement by {hhmm(minute)} (usually {hhmm(usual)})",
                    detected_at=now,
                    details={"usual_first": usual, "threshold": usual + buffer},
                )
            )
    last = max((r.last_event_ts for r in routines.values() if r.last_event_ts), default=None)
    if last and _waking(minute, cfg) and local(last, tz).date() == today:
        idle = now - last
        if idle > timedelta(minutes=cfg.inactivity_minutes):
            hours = int(idle.total_seconds() // 3600)
            out.append(
                Anomaly(
                    home_id=home_id,
                    kind="long_inactivity",
                    zone=None,
                    reason=f"No movement anywhere for {hours} hours",
                    detected_at=now,
                    details={"idle_minutes": int(idle.total_seconds() // 60)},
                )
            )
    return out


# backfill.py ---------------------------------------------------------------
def build_routines(events: Iterable[Event], tz: str = TIMEZONE) -> dict[str, Routine]:
    """Replay events oldest-first into fresh routines. O(n log n) for the sort."""
    routines: dict[str, Routine] = {}
    for e in sorted(events, key=lambda ev: ev.ts):
        r = routines.get(e.zone) or routines.setdefault(e.zone, new_routine(e.home_id, e.zone))
        update_on_event(r, e, tz)
    return routines


# digest ----------------------------------------------------------------------
def generate_digest(home: dict, events: list[Event], alerts: list[dict], day: date) -> str:
    """Template digest (no Bedrock): only states counted facts."""
    name = home.get("parent_name", "Your parent")
    counted = [e for e in events if e.type in ENGINE_EVENT_TYPES]
    if not counted:
        return f"No activity was recorded for {name} on {day:%d %b}."
    first, last = local(counted[0].ts), local(counted[-1].ts)
    zones = sorted({ZONE_LABELS.get(e.zone, e.zone) for e in counted})
    dings = sum(1 for e in counted if e.type == "ding")
    text = (
        f"{name}'s day on {day:%d %b}: first activity at {first:%H:%M}, last at {last:%H:%M}. "
        f"Activity seen in the {', '.join(zones)} ({len(counted)} events)."
    )
    if dings:
        text += f" The doorbell rang {dings} time{'s' if dings > 1 else ''}."
    if alerts:
        text += f" {len(alerts)} alert{'s' if len(alerts) > 1 else ''} today, all followed up."
    return text


def describe_visitor(image_bytes: bytes) -> dict:
    return {
        "summary": "Visitor at the door (description unavailable offline).",
        "person_count": 1,
        "uniform_or_badge": False,
        "carrying_package": False,
        "caution": False,
        "caution_reason": "",
    }


def weekly_trend(routine: Routine) -> str | None:
    return None
