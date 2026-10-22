"""Read models shared by the API, the scheduler and notifications. All keyed reads."""

from __future__ import annotations

from typing import Any

from backend.common.config import ZONES
from backend.common.store import Store
from backend.common.timeutil import parse_iso, to_iso

RED_STATES = frozenset({"ALERT_FAMILY", "ALERT_NEIGHBOUR"})
YELLOW_STATES = frozenset({"SUSPECT", "NUDGE_PARENT"})


def home_zones(home: dict[str, Any]) -> list[str]:
    """Zones the home has devices for, in contract order."""
    present = set((home.get("devices") or {}).values())
    return [z for z in ZONES if z in present]


def last_seen(routines: dict[str, dict[str, Any]]) -> dict[str, str] | None:
    """Most recent activity over the zones' routines: O(zones), no event query."""
    best: tuple[str, str] | None = None
    for zone, r in routines.items():
        ts = r.get("last_event_ts")
        if ts and (best is None or parse_iso(ts) > parse_iso(best[1])):
            best = (zone, ts)
    return {"zone": best[0], "ts": to_iso(parse_iso(best[1]))} if best else None


def status(store: Store, home_id: str) -> dict[str, Any]:
    """Contract 4.4 status rule: red / yellow / green from the open alert. O(zones)."""
    alert = store.get_open_alert(home_id)
    if alert is None:
        colour = "green"
    elif alert["state"] in RED_STATES:
        colour = "red"
    else:
        colour = "yellow"
    return {
        "home_id": home_id,
        "status": colour,
        "reason": alert["reason"] if alert else None,
        "last_seen": last_seen(store.get_routines(home_id)),
        "active_alert_id": alert["alert_id"] if alert else None,
    }
