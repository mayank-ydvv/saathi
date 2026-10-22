"""Single import point for the engine and digest functions (contract 4.3).

Uses Krishnaditya's modules in `backend/engine/` and `backend/digest/` when they exist and
falls back to `engine_stub` until then, so callers never change their imports.
"""

from __future__ import annotations

from collections.abc import Iterable

from backend.common import engine_stub as _stub
from backend.common.config import TIMEZONE
from backend.engine.models import Event, Routine

try:
    from backend.engine.routine import (
        new_routine,
        rollover_day,
        routine_from_dict,
        routine_to_dict,
        update_on_event,
    )
except ImportError:
    new_routine = _stub.new_routine
    update_on_event = _stub.update_on_event
    rollover_day = _stub.rollover_day
    routine_to_dict = _stub.routine_to_dict
    routine_from_dict = _stub.routine_from_dict

try:
    from backend.engine.anomaly import check_event, check_tick
except ImportError:
    check_event = _stub.check_event
    check_tick = _stub.check_tick

try:
    from backend.engine.backfill import build_routines
except ImportError:

    def build_routines(events: Iterable[Event], tz: str = TIMEZONE) -> dict[str, Routine]:
        """Replay events oldest-first with whichever routine functions are active, so the
        result always matches what live ingest produces (e.g. the real engine's day_slots).
        O(n log n) for the one sort."""
        routines: dict[str, Routine] = {}
        for e in sorted(events, key=lambda ev: ev.ts):
            r = routines.get(e.zone)
            if r is None:
                r = routines[e.zone] = new_routine(e.home_id, e.zone)
            update_on_event(r, e, tz)
        return routines


try:
    from backend.digest import describe_visitor, generate_digest, weekly_trend
except ImportError:
    generate_digest = _stub.generate_digest
    describe_visitor = _stub.describe_visitor
    weekly_trend = _stub.weekly_trend

__all__ = [
    "build_routines",
    "check_event",
    "check_tick",
    "describe_visitor",
    "generate_digest",
    "new_routine",
    "rollover_day",
    "routine_from_dict",
    "routine_to_dict",
    "update_on_event",
    "weekly_trend",
]
