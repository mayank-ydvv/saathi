"""Escalation interface plus the shared, idempotent "resolve" operation.

Implementations: `ImmediateEscalator` (no timers: alerts wait in SUSPECT until acked),
the local asyncio ladder and the Step Functions starter (see `ladder.py`).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Protocol

from backend.common.store import Store
from backend.common.timeutil import to_iso
from backend.escalation.alerts import OPEN_STATES

AckBy = Literal["parent", "family", "neighbour"]


class Escalator(Protocol):
    def start(self, alert: dict[str, Any]) -> None:
        """Begin moving a freshly created SUSPECT alert up the ladder."""

    def ack(self, alert_id: str, by: AckBy, name: str) -> dict[str, Any] | None:
        """Resolve the alert (idempotent). None if the alert doesn't exist."""


def resolve(
    store: Store, alert_id: str, by: AckBy, name: str, now: datetime
) -> tuple[dict[str, Any] | None, bool]:
    """Move an open alert straight to RESOLVED. Returns (alert, changed).

    Idempotent: acking a resolved alert returns it unchanged, keeping the first acker.
    The write is conditional on the state just read, so a ladder step racing this ack
    (another Lambda) can't overwrite RESOLVED; on a lost race we re-read and retry.
    """
    for _ in range(3):
        alert = store.find_alert(alert_id)
        if alert is None:
            return None, False
        if alert["state"] not in OPEN_STATES:
            return alert, False
        previous, at = alert["state"], to_iso(now)
        alert["state"] = "RESOLVED"
        alert["resolved_at"] = at
        alert["acked_by"] = {"by": by, "name": name}
        alert["steps"] = [*alert["steps"], {"state": "RESOLVED", "at": at}]
        if store.put_alert(alert, expected_state=previous):
            store.release_open_alert(alert["home_id"], alert_id)
            return alert, True
    raise RuntimeError(f"could not resolve {alert_id}: concurrent updates")


class ImmediateEscalator:
    """No timers: alerts stay where they are until acknowledged."""

    def __init__(self, store: Store, now=None) -> None:
        from backend.common import clock

        self._store = store
        self._now = now or clock.now

    def start(self, alert: dict[str, Any]) -> None:
        return None

    def ack(self, alert_id: str, by: AckBy, name: str) -> dict[str, Any] | None:
        alert, _ = resolve(self._store, alert_id, by, name, self._now())
        return alert
