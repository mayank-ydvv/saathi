"""Lambda entry point for the 1-minute EventBridge schedule: rollover + anomaly checks."""

from __future__ import annotations

from typing import Any

from backend.handlers import runtime


def handler(event: dict[str, Any] | None = None, context: Any = None) -> dict[str, Any]:
    result = runtime.scheduler().tick()
    return {
        "anomalies": [a.kind for a in result.anomalies],
        "alerts": [a["alert_id"] for a in result.alerts],
        "rolled_over": result.rolled_over,
        "digests": len(result.digests),
    }
