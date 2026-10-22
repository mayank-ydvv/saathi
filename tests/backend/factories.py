"""Small builders shared by backend tests."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from backend.engine.models import Event

IST = ZoneInfo("Asia/Kolkata")
HOME = "home-demo-1"


def at(day: date, hhmm: str) -> datetime:
    """Aware datetime for local IST `day` `HH:MM`."""
    h, m = (int(x) for x in hhmm.split(":"))
    return datetime(day.year, day.month, day.day, h, m, tzinfo=IST)


def event(zone: str, ts: datetime, type_: str = "motion.human", n: int = 0) -> Event:
    return Event(
        event_id=f"evt_{zone}_{ts:%Y%m%d%H%M}_{n}",
        home_id=HOME,
        device_id=f"dev_{zone}",
        zone=zone,
        type=type_,
        ts=ts,
    )


def normal_days(start: date, days: int = 14) -> list[Event]:
    """A calm routine: bedroom ~06:45, kitchen ~08:05, living room afternoon, door 07:30."""
    out: list[Event] = []
    for i in range(days):
        d = start + timedelta(days=i)
        jitter = (i % 5) - 2  # -2..+2 minutes
        for zone, times in {
            "bedroom": ["06:45", "21:30"],
            "kitchen": ["08:05", "13:00", "19:30"],
            "living_room": ["10:00", "16:00", "20:00"],
            "front_door": ["07:30"],
        }.items():
            for t in times:
                out.append(event(zone, at(d, t) + timedelta(minutes=jitter)))
    return out
