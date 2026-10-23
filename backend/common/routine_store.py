"""Optimistic read-modify-write of one zone's routine (fix H9 in docs/ERRORS.md).

Ingest (on every event) and the minute tick (rollover, "fired" markers) both change the same
routine item. Each write here is conditional on the `rev` that was read; on a lost race the
routine is re-read and `change` applied again, so neither side drops the other's update.
O(1) store calls per attempt.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

from backend.common import engine
from backend.common.store import Store
from backend.engine.models import Routine

T = TypeVar("T")
TRIES = 5


def update_routine(
    store: Store, home_id: str, zone: str, change: Callable[[Routine], T]
) -> tuple[Routine, T]:
    """Apply `change` to the stored routine (a new one if missing) and save it atomically.

    `change` may run more than once, so it must only depend on the routine it is given.
    """
    for _ in range(TRIES):
        stored = store.get_routine(home_id, zone)
        rev = int(stored.get("rev", 0)) if stored else 0
        routine = engine.routine_from_dict(stored) if stored else engine.new_routine(home_id, zone)
        result = change(routine)
        if store.put_routine(engine.routine_to_dict(routine), expected_rev=rev):
            return routine, result
    raise RuntimeError(f"routine {home_id}/{zone}: too many concurrent updates")
