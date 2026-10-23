"""Routine learning: fold Ring events into a per-zone daily rhythm (contract 4.3).

Pure functions, no I/O. Functions mutate the Routine in place AND return it, so callers may
use either style (the scheduler calls `rollover_day` for its side effect).

Choices:
- Only activity types (`motion.human`, `motion`, `ding`) count. Other events leave the
  routine untouched, including `last_event_ts`, so inactivity is measured from real movement.
- Events from a local day before `r.today` (late, out-of-order deliveries) are ignored: that
  day is already closed into `hist`. Out-of-order events within today are handled.
- The window is the last D *active* days. A day with no activity in a zone is not a sample of
  when that zone is used, so it does not dilute `hist` or the first-activity median.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from statistics import median
from zoneinfo import ZoneInfo

from backend.engine.models import Event, Routine

TIMEZONE = "Asia/Kolkata"
SLOTS_PER_DAY = 96
SLOT_MINUTES = 15
HISTORY_DAYS = 14  # D
ACTIVITY_TYPES = frozenset({"motion.human", "motion", "ding"})


def new_routine(home_id: str, zone: str) -> Routine:
    """Empty routine for one (home_id, zone). O(1)."""
    return Routine(
        home_id=home_id,
        zone=zone,
        hist=[0] * SLOTS_PER_DAY,
        days_seen=0,
        first_times=[],
        median_first=None,
        mad_first=None,
        last_event_ts=None,
        today=None,
        today_first=None,
        today_slots=set(),
        day_slots=[],
        fired={},
    )


def update_on_event(r: Routine, e: Event, tz: str = TIMEZONE) -> Routine:
    """Fold one event into today's accumulators. O(1), plus a once-a-day rollover."""
    if e.type not in ACTIVITY_TYPES:
        return r
    t = e.ts.astimezone(ZoneInfo(tz))
    day, minute = t.date(), t.hour * 60 + t.minute
    if r.today is None:
        r.today = day
    elif day > r.today:
        rollover_day(r, day)
    elif day < r.today:
        return r
    r.today_slots.add(minute // SLOT_MINUTES)
    if r.today_first is None or minute < r.today_first:
        r.today_first = minute
    if r.last_event_ts is None or e.ts > r.last_event_ts:
        r.last_event_ts = e.ts
    return r


def rollover_day(r: Routine, new_day: date) -> Routine:
    """Close `r.today` into the window and start `new_day`. O(D log D) for the median.

    No-op when `new_day` is not after `r.today`. A closed day without activity adds nothing.
    """
    if r.today is not None and new_day <= r.today:
        return r
    if r.today_slots:
        # Days learned before `day_slots` existed (older stored records) aren't in the list,
        # so they can't be evicted exactly; count them conservatively instead.
        untracked = r.days_seen > len(r.day_slots)
        slots = sorted(r.today_slots)
        for s in slots:
            r.hist[s] += 1
        r.day_slots.append(slots)
        r.first_times.append(r.today_first)
        if len(r.day_slots) > HISTORY_DAYS:
            for s in r.day_slots.pop(0):
                r.hist[s] -= 1
        del r.first_times[:-HISTORY_DAYS]
        if untracked:
            r.days_seen = min(r.days_seen + 1, HISTORY_DAYS)
            r.hist = [min(n, r.days_seen) for n in r.hist]  # O(96), only for old records
        else:
            r.days_seen = len(r.day_slots)
        med = int(median(r.first_times))
        r.median_first = med
        r.mad_first = int(median(abs(x - med) for x in r.first_times))
    r.today, r.today_first, r.today_slots = new_day, None, set()
    return r


def routine_to_dict(r: Routine) -> dict:
    """JSON/DynamoDB-safe dict: ints, lists and ISO strings only. O(D + slots)."""
    return {
        "home_id": r.home_id,
        "zone": r.zone,
        "hist": list(r.hist),
        "days_seen": r.days_seen,
        "first_times": list(r.first_times),
        "median_first": r.median_first,
        "mad_first": r.mad_first,
        "last_event_ts": _iso_z(r.last_event_ts) if r.last_event_ts else None,
        "today": r.today.isoformat() if r.today else None,
        "today_first": r.today_first,
        "today_slots": sorted(r.today_slots),
        "day_slots": [list(d) for d in r.day_slots],
        "fired": dict(r.fired),
    }


def routine_from_dict(d: dict) -> Routine:
    """Inverse of `routine_to_dict`. Accepts DynamoDB Decimals and records without `day_slots`."""
    return Routine(
        home_id=d["home_id"],
        zone=d["zone"],
        hist=[int(x) for x in d["hist"]],
        days_seen=int(d["days_seen"]),
        first_times=[int(x) for x in d.get("first_times") or []],
        median_first=_opt_int(d.get("median_first")),
        mad_first=_opt_int(d.get("mad_first")),
        last_event_ts=_parse_iso(d["last_event_ts"]) if d.get("last_event_ts") else None,
        today=date.fromisoformat(d["today"]) if d.get("today") else None,
        today_first=_opt_int(d.get("today_first")),
        today_slots={int(x) for x in d.get("today_slots") or []},
        day_slots=[[int(s) for s in day] for day in d.get("day_slots") or []],
        fired=dict(d.get("fired") or {}),
    )


def _opt_int(x: object) -> int | None:
    return None if x is None else int(x)  # type: ignore[call-overload]


def _iso_z(ts: datetime) -> str:
    return ts.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))
