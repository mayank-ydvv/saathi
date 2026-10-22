"""Map a Ring webhook (`ring_sandbox.WebhookEvent`, v1.1 payload) to a normalized event (4.2).

Ring webhooks say `motion_detected` + `sub_type`, or `button_press`; the engine wants the
history-style names from contract 4.2. Other event types (sensors, lifecycle) keep their
raw name: they are stored but the engine ignores them.
"""

from __future__ import annotations

import hashlib
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from ring_sandbox import WebhookEvent

from backend.common import clock
from backend.common.timeutil import to_iso

MOTION_SUBTYPES = {"human": "motion.human", "vehicle": "vehicle", "package": "package"}


def normalize_type(event_type: str, sub_type: str | None) -> str:
    """O(1) lookup: motion_detected+human -> motion.human, button_press -> ding, ..."""
    if event_type == "motion_detected":
        return MOTION_SUBTYPES.get(sub_type or "", "motion")
    if event_type == "button_press":
        return "ding"
    return event_type


def make_event_id(ring_event_id: str) -> str:
    """Deterministic short id: the same Ring event (or a retried delivery) maps to one id."""
    return "evt_" + hashlib.sha256(ring_event_id.encode()).hexdigest()[:16]


def occurred_at(wh: WebhookEvent) -> datetime:
    """When it happened in the real world (aware UTC)."""
    ts = wh.occurred_at
    return ts.replace(tzinfo=UTC) if ts.tzinfo is None else ts.astimezone(UTC)


def normalize(
    wh: WebhookEvent,
    home: dict[str, Any],
    shift: Callable[[datetime], datetime] = clock.shift,
) -> dict[str, Any] | None:
    """Normalized event dict, or None when the device isn't mapped to a zone in this home."""
    zone = (home.get("devices") or {}).get(wh.device_id)
    if not zone:
        return None
    return {
        "event_id": make_event_id(wh.data.id),
        "home_id": home["home_id"],
        "device_id": wh.device_id,
        "zone": zone,
        "type": normalize_type(wh.event_type, wh.sub_type),
        "ts": to_iso(shift(occurred_at(wh))),
        "snapshot_key": None,
    }
