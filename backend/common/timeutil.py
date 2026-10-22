"""Timestamp helpers: UTC ISO-8601 `Z` strings (contract 4.1) and Asia/Kolkata local days."""

from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from backend.common.config import SLOT_MINUTES, TIMEZONE

ISO_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


def to_iso(dt: datetime) -> str:
    """Format an aware datetime as a UTC `...Z` string with second precision."""
    return dt.astimezone(UTC).strftime(ISO_FORMAT)


def parse_iso(value: str) -> datetime:
    """Parse an ISO-8601 string (with `Z` or an offset) into an aware UTC datetime."""
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def local(dt: datetime, tz: str = TIMEZONE) -> datetime:
    return dt.astimezone(ZoneInfo(tz))


def local_date(dt: datetime, tz: str = TIMEZONE) -> date:
    return local(dt, tz).date()


def local_day_bounds(day: date, tz: str = TIMEZONE) -> tuple[datetime, datetime]:
    """UTC [start, end) covering the local calendar day `day`."""
    zone = ZoneInfo(tz)
    start = datetime.combine(day, time.min, tzinfo=zone)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=zone)
    return start.astimezone(UTC), end.astimezone(UTC)


def minute_of_day(dt: datetime, tz: str = TIMEZONE) -> int:
    t = local(dt, tz)
    return t.hour * 60 + t.minute


def slot_index(dt: datetime, tz: str = TIMEZONE) -> int:
    """Contract 4.1 slot: (local_hour * 60 + local_minute) // 15, in 0..95."""
    return minute_of_day(dt, tz) // SLOT_MINUTES


def hhmm(minutes: int | None) -> str | None:
    """Minutes after midnight -> "HH:MM"."""
    if minutes is None:
        return None
    minutes %= 24 * 60
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def parse_hhmm(value: str) -> int:
    """ "HH:MM" -> minutes after midnight."""
    h, m = value.split(":")
    return int(h) * 60 + int(m)
