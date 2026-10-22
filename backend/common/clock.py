"""Process clock with an optional demo offset.

`ring-sandbox play` always emits events near the real "now", but the demo story needs a
specific local time (e.g. 10:20 for a late start). The demo clock is the real UTC time plus
a fixed offset. Ingest shifts incoming Ring timestamps by the same offset, so events, the
scheduler and alerts all agree. The raw Ring timestamp is kept for snapshot calls (Ring
rejects future timestamps). With no offset set, this is just `datetime.now(UTC)`.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from threading import Lock
from zoneinfo import ZoneInfo

from backend.common.config import TIMEZONE

_offset = timedelta(0)
_lock = Lock()


def real_now() -> datetime:
    return datetime.now(UTC)


def now() -> datetime:
    """Current time on the (possibly shifted) demo clock, aware UTC. O(1)."""
    return real_now() + _offset


def offset() -> timedelta:
    return _offset


def set_offset(delta: timedelta) -> None:
    global _offset
    with _lock:
        _offset = delta


def reset() -> None:
    set_offset(timedelta(0))


def set_start(start: datetime) -> None:
    """Make `now()` read `start` at this instant, then keep ticking in real time."""
    set_offset(start.astimezone(UTC) - real_now())


def set_local_time(hhmm: str, day: date | None = None, tz: str = TIMEZONE) -> datetime:
    """Jump the clock to local `HH:MM` on `day` (default: today, local). Returns the new now."""
    zone = ZoneInfo(tz)
    day = day or real_now().astimezone(zone).date()
    h, m = (int(p) for p in hhmm.split(":"))
    target = datetime(day.year, day.month, day.day, h, m, tzinfo=zone)
    set_start(target)
    return now()


def shift(ts: datetime) -> datetime:
    """Map a real-world timestamp (e.g. from Ring) onto the demo clock."""
    return ts + _offset
