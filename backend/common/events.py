"""Convert between the stored/JSON event shape (contract 4.2) and the engine `Event`."""

from __future__ import annotations

from typing import Any

from backend.common.timeutil import parse_iso, to_iso
from backend.engine.models import Event


def event_sort_key(event: dict[str, Any]) -> str:
    """DynamoDB sort key for `saathi-events`: ISO ts + "#" + event_id (contract 4.5)."""
    return f"{event['ts']}#{event['event_id']}"


def event_to_dict(e: Event) -> dict[str, Any]:
    return {
        "event_id": e.event_id,
        "home_id": e.home_id,
        "device_id": e.device_id,
        "zone": e.zone,
        "type": e.type,
        "ts": to_iso(e.ts),
        "snapshot_key": e.snapshot_key,
    }


def event_from_dict(d: dict[str, Any]) -> Event:
    return Event(
        event_id=d["event_id"],
        home_id=d["home_id"],
        device_id=d["device_id"],
        zone=d["zone"],
        type=d["type"],
        ts=parse_iso(d["ts"]),
        snapshot_key=d.get("snapshot_key"),
    )
