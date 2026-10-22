"""Alert records (contract 4.4): create one from an anomaly, with dedupe.

Rules:
- At most one open alert per home; while one is open, new anomalies are dropped.
- A resolved anomaly isn't raised again straight away: same kind + zone is suppressed for
  the rest of the local day (late_start, long_inactivity) or for 30 minutes (night_activity,
  so a second door opening at 3am still alerts).
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Any

from backend.common.store import Store
from backend.common.timeutil import local_date, parse_iso, to_iso
from backend.engine.models import Anomaly

STATES = ("SUSPECT", "NUDGE_PARENT", "ALERT_FAMILY", "ALERT_NEIGHBOUR", "RESOLVED")
OPEN_STATES = frozenset(STATES[:-1])
NIGHT_REPEAT_WINDOW = timedelta(minutes=30)
DEDUPE_LOOKBACK = 10  # newest alerts checked for a repeat (O(1) work)


def new_alert_id(now: datetime) -> str:
    """`alt_` + 12 hex digits of epoch ms + 4 random hex: lexicographic order == time order."""
    return f"alt_{int(now.timestamp() * 1000):012x}{secrets.token_hex(2)}"


def alert_from_anomaly(anomaly: Anomaly, now: datetime) -> dict[str, Any]:
    at = to_iso(now)
    return {
        "alert_id": new_alert_id(now),
        "home_id": anomaly.home_id,
        "kind": anomaly.kind,
        "zone": anomaly.zone,
        "reason": anomaly.reason,
        "state": "SUSPECT",
        "created_at": at,
        "resolved_at": None,
        "acked_by": None,
        "steps": [{"state": "SUSPECT", "at": at}],
    }


def _is_repeat(previous: dict[str, Any], anomaly: Anomaly, now: datetime) -> bool:
    if previous["kind"] != anomaly.kind or previous.get("zone") != anomaly.zone:
        return False
    created = parse_iso(previous["created_at"])
    if anomaly.kind == "night_activity":
        return now - created < NIGHT_REPEAT_WINDOW
    return local_date(created) == local_date(now)


def open_alert(store: Store, anomaly: Anomaly, now: datetime) -> dict[str, Any] | None:
    """Create and save a SUSPECT alert for `anomaly`, or None if one is open / it's a repeat.

    O(1): reads at most DEDUPE_LOOKBACK of the newest alerts.
    """
    recent = store.list_alerts(anomaly.home_id, DEDUPE_LOOKBACK)
    if recent and recent[0]["state"] in OPEN_STATES:
        return None
    if any(_is_repeat(a, anomaly, now) for a in recent):
        return None
    alert = alert_from_anomaly(anomaly, now)
    store.put_alert(alert)
    return alert
