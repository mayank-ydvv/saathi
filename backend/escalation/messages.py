"""Human-facing text for nudges and alerts (times shown in Asia/Kolkata)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from backend.common.timeutil import local, parse_iso

ZONE_LABELS = {
    "front_door": "front door",
    "kitchen": "kitchen",
    "living_room": "living room",
    "bedroom": "bedroom",
}
STEP_TITLES = {
    "SUSPECT": "Checking",
    "NUDGE_PARENT": "Asked the parent",
    "ALERT_FAMILY": "Family alert",
    "ALERT_NEIGHBOUR": "Neighbour alert",
    "RESOLVED": "Resolved",
}


def greeting(now: datetime) -> str:
    """By local hour. Before 05:00 it is still night, so no "Good morning" at 02:10 (L2)."""
    hour = local(now).hour
    if hour < 5:
        return "Hello"
    if hour < 12:
        return "Good morning"
    if hour < 17:
        return "Good afternoon"
    return "Good evening"


def nudge_text(parent_name: str, now: datetime) -> str:
    """Spoken + shown on the parent app, e.g. "Good morning Kamala, are you okay? ..."."""
    return f"{greeting(now)} {parent_name}, are you okay? Please press the green button."


def last_seen_text(last_seen: dict[str, str] | None) -> str:
    if not last_seen:
        return "no activity recorded yet"
    zone = ZONE_LABELS.get(last_seen["zone"], last_seen["zone"])
    return f"{zone} at {local(parse_iso(last_seen['ts'])):%H:%M}"


def alert_text(
    alert: dict[str, Any], home: dict[str, Any], last_seen: dict[str, str] | None
) -> str:
    """Telegram/SNS body for a family or neighbour alert."""
    parent = home.get("parent_name", "your parent")
    step = STEP_TITLES.get(alert["state"], alert["state"])
    city = f" ({home['city']})" if home.get("city") else ""  # no "()" without a city (L4)
    return (
        f"Saathi: {step} for {parent}{city}\n"
        f"{alert['reason']}\n"
        f"Last seen: {last_seen_text(last_seen)}\n"
        f"{parent} did not answer the check-in. Please call or visit."
    )
