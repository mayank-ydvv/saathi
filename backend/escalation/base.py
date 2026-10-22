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
    """
    alert = store.find_alert(alert_id)
    if alert is None:
        return None, False
    if alert["state"] not in OPEN_STATES:
        return alert, False
    at = to_iso(now)
    alert["state"] = "RESOLVED"
    alert["resolved_at"] = at
    alert["acked_by"] = {"by": by, "name": name}
    alert["steps"] = [*alert["steps"], {"state": "RESOLVED", "at": at}]
    store.put_alert(alert)
    return alert, True


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
