"""Single import point for the engine and digest functions (contract 4.3).

Uses Krishnaditya's modules in `backend/engine/` and `backend/digest/` when they exist and
falls back to `engine_stub` until then, so callers never change their imports.
"""

from __future__ import annotations

from backend.common import engine_stub as _stub

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
    build_routines = _stub.build_routines

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
