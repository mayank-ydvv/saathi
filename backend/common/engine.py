"""Single import point for the engine and digest functions (contract 4.3).

Re-exports Krishnaditya's `backend/engine/` and `backend/digest/` so backend callers (and
tests that monkeypatch them) go through one module.
"""

from __future__ import annotations

from backend.digest import describe_visitor, generate_digest, weekly_trend
from backend.engine.anomaly import check_event, check_tick
from backend.engine.backfill import build_routines
from backend.engine.routine import (
    new_routine,
    rollover_day,
    routine_from_dict,
    routine_to_dict,
    update_on_event,
)

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
