"""Alert records (contract 4.4): create one from an anomaly, with dedupe.

Rules:
- At most one open alert per home, enforced atomically with the home's open-alert pointer
  (`Store.claim_open_alert`), so the ingest and tick Lambdas can't both open one (H10).
- An open alert older than STALE_AFTER that nobody answered is expired (closed with
  `expired: true`) when a new anomaly arrives, so monitoring never stops for good (H1).
- A resolved anomaly isn't raised again straight away: same kind + zone is suppressed for
  the rest of the local day (late_start, long_inactivity) or for 30 minutes (night_activity,
  so a second door opening at 3am still alerts).
"""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Any, Literal

from backend.common import clock
from backend.common.store import Store
from backend.common.timeutil import local_date, parse_iso, to_iso
from backend.engine.models import Anomaly

STATES = ("SUSPECT", "NUDGE_PARENT", "ALERT_FAMILY", "ALERT_NEIGHBOUR", "RESOLVED")
OPEN_STATES = frozenset(STATES[:-1])
NIGHT_REPEAT_WINDOW = timedelta(minutes=30)
STALE_AFTER = timedelta(hours=24)
DEDUPE_LOOKBACK = 10  # newest alerts checked for a repeat (O(1) work)

OpenOutcome = Literal["opened", "open", "repeat"]


def new_alert_id(now: datetime | None = None) -> str:
    """`alt_` + 12 hex digits of epoch ms + 4 random hex. Always from the *real* clock, so
    ids keep sorting by creation even when the demo clock is moved backwards (H3)."""
    real = clock.real_now() if now is None else now
    return f"alt_{int(real.timestamp() * 1000):012x}{secrets.token_hex(2)}"


def alert_from_anomaly(anomaly: Anomaly, now: datetime) -> dict[str, Any]:
    at = to_iso(now)
    return {
        "alert_id": new_alert_id(),
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
    if previous.get("expired"):  # nobody answered it: a new anomaly must still get through
        return False
    if previous["kind"] != anomaly.kind or previous.get("zone") != anomaly.zone:
        return False
    created = parse_iso(previous["created_at"])
    if anomaly.kind == "night_activity":
        return now - created < NIGHT_REPEAT_WINDOW
    return local_date(created) == local_date(now)


def expire(store: Store, alert: dict[str, Any], now: datetime) -> bool:
    """Close an unanswered open alert (no acker). Conditional on its state. O(1)."""
    at = to_iso(now)
    closed = {
        **alert,
        "state": "RESOLVED",
        "resolved_at": at,
        "expired": True,
        "steps": [*alert["steps"], {"state": "RESOLVED", "at": at}],
    }
    if not store.put_alert(closed, expected_state=alert["state"]):
        return False
    store.release_open_alert(alert["home_id"], alert["alert_id"])
    return True


def try_open_alert(
    store: Store, anomaly: Anomaly, now: datetime
) -> tuple[dict[str, Any] | None, OpenOutcome]:
    """Create and save a SUSPECT alert for `anomaly`. Returns (alert, "opened"), or
    (None, "open") if another alert is open, or (None, "repeat") for a suppressed repeat.

    O(1): one pointer read, at most DEDUPE_LOOKBACK of the newest alerts, one claim.
    """
    current = store.get_open_alert(anomaly.home_id)
    fresh = current is not None and now - parse_iso(current["created_at"]) < STALE_AFTER
    if current is not None and (fresh or not expire(store, current, now)):
        return None, "open"
    recent = store.list_alerts(anomaly.home_id, DEDUPE_LOOKBACK)
    if any(_is_repeat(a, anomaly, now) for a in recent):
        return None, "repeat"
    alert = alert_from_anomaly(anomaly, now)
    if not store.claim_open_alert(anomaly.home_id, alert["alert_id"]):
        return None, "open"  # another Lambda opened one a moment ago
    store.put_alert(alert)
    return alert, "opened"


def open_alert(store: Store, anomaly: Anomaly, now: datetime) -> dict[str, Any] | None:
    """`try_open_alert` without the reason: the alert, or None."""
    return try_open_alert(store, anomaly, now)[0]
