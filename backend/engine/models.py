"""Engine data model (shared contract 4.3). Dataclasses only, no logic.

Owned by Krishnaditya. Field names and types are a shared contract: see docs/CONTRACTS.md.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime


@dataclass(slots=True)
class Event:
    """A normalized Ring event (mirrors contract 4.2)."""

    event_id: str
    home_id: str
    device_id: str
    zone: str
    type: str
    ts: datetime  # timezone-aware UTC
    snapshot_key: str | None = None


@dataclass(slots=True)
class Routine:
    """Learned daily rhythm for one (home_id, zone)."""

    home_id: str
    zone: str
    hist: list[int]  # length 96, count of active days per slot over the window
    days_seen: int  # number of days contributing to hist (<= D)
    first_times: list[int]  # first-activity minute-of-day for each of the last <= D days
    median_first: int | None  # minutes after local midnight
    mad_first: int | None  # minutes
    last_event_ts: datetime | None
    today: date | None  # local date currently being accumulated
    today_first: int | None  # first-activity minute today, None if no activity yet
    today_slots: set[int]  # slots active today (so a slot counts once per day)
    # Additive (allowed by 4.3): active slots of each closed day in the window, oldest first,
    # so the day that falls out of the D-day window can be subtracted from hist without a scan.
    day_slots: list[list[int]] = field(default_factory=list)
    # Additive: anomaly kind -> local ISO date it last fired, so each kind fires once a day.
    fired: dict[str, str] = field(default_factory=dict)


@dataclass(slots=True)
class Anomaly:
    home_id: str
    kind: str  # "late_start" | "long_inactivity" | "night_activity"
    zone: str | None  # None for home-wide checks (long_inactivity)
    reason: str  # human sentence, e.g. "No kitchen movement by 10:15 (usually 08:05)"
    detected_at: datetime
    details: dict


@dataclass(slots=True)
class EngineConfig:
    late_buffer_min_floor: int = 30  # minimum buffer added to the median
    mad_multiplier: float = 3.0
    inactivity_minutes: int = 240
    waking_start: str = "06:00"  # inactivity is only checked between these
    waking_end: str = "22:00"
    night_rare_ratio: float = 0.05
    min_days_for_checks: int = 5  # below this, use cold-start defaults
    default_first_activity: str = "08:00"
    night_repeat_minutes: int = 30  # a later rare night event in the zone alerts again
    night_max_per_night: int = 3
