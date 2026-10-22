"""Webhook ingest pipeline, independent of FastAPI so Lambda and tests can call it directly.

handle(): verify HMAC -> parse -> find the home -> normalize -> idempotent store ->
          night check -> update routine -> open an alert and start escalation.
attach_snapshot(): for doorbell dings, fetch the snapshot via RingClient, save it, and add a
          visitor description (when enabled). Runs after the HTTP response.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from ring_sandbox import webhooks

from backend.common import clock, engine
from backend.common.config import ENGINE_EVENT_TYPES, Settings
from backend.common.events import event_from_dict
from backend.common.store import Store
from backend.engine.models import EngineConfig
from backend.escalation.alerts import open_alert
from backend.ingest.normalize import normalize, occurred_at
from backend.ingest.ring_client import RingGateway

log = logging.getLogger(__name__)

# The emulator stamps meta.time at send; reject captured deliveries replayed much later.
MAX_DELIVERY_AGE_S = 3600


def image_type(data: bytes) -> tuple[str, str]:
    """(extension, MIME) from magic bytes: the emulator serves PNG placeholders, Ring JPEG."""
    if data.startswith(b"\x89PNG"):
        return "png", "image/png"
    return "jpg", "image/jpeg"


@dataclass(slots=True)
class IngestResult:
    status: str  # "stored" | "duplicate" | "ignored"
    event: dict[str, Any] | None = None
    alert: dict[str, Any] | None = None
    ring_ts: datetime | None = None  # real Ring time, for snapshot lookups

    @property
    def wants_snapshot(self) -> bool:
        return self.status == "stored" and self.event is not None and self.event["type"] == "ding"


class IngestService:
    def __init__(
        self,
        store: Store,
        settings: Settings,
        ring: RingGateway | None = None,
        escalate: Callable[[dict[str, Any]], None] | None = None,
        engine_config: EngineConfig | None = None,
    ) -> None:
        self.store = store
        self.settings = settings
        self.ring = ring
        self.escalate = escalate or (lambda alert: None)
        self.cfg = engine_config or EngineConfig()

    def _home_for_device(self, device_id: str) -> dict[str, Any] | None:
        """O(H) key lookups over configured homes (H = 1 for the demo)."""
        for home_id in self.settings.home_ids:
            home = self.store.get_home(home_id)
            if home and device_id in (home.get("devices") or {}):
                return home
        return None

    def handle(self, raw_body: bytes, signature: str | None) -> IngestResult:
        """Process one delivery. Raises `webhooks.SignatureError` on a bad/missing signature
        and pydantic's ValidationError on a malformed body. O(1) store work per event."""
        wh = webhooks.parse(
            raw_body,
            signing_key=self.settings.ring_webhook_hmac_key,
            signature=signature,
            max_age_s=MAX_DELIVERY_AGE_S,
        )
        home = self._home_for_device(wh.device_id)
        event = normalize(wh, home) if home else None
        if event is None:
            log.info("ignoring %s from unmapped device %s", wh.event_type, wh.device_id)
            return IngestResult("ignored")
        if not self.store.put_event_if_new(event):
            return IngestResult("duplicate", event)
        alert = self._learn_and_check(event) if event["type"] in ENGINE_EVENT_TYPES else None
        return IngestResult("stored", event, alert, occurred_at(wh))

    def _learn_and_check(self, event: dict[str, Any]) -> dict[str, Any] | None:
        """Night check against history *before* this event, then fold the event in."""
        ev = event_from_dict(event)
        stored = self.store.get_routine(ev.home_id, ev.zone)
        routine = (
            engine.routine_from_dict(stored) if stored else engine.new_routine(ev.home_id, ev.zone)
        )
        anomaly = engine.check_event(routine, ev, self.cfg)
        routine = engine.update_on_event(routine, ev)
        self.store.put_routine(engine.routine_to_dict(routine))
        if anomaly is None:
            return None
        alert = open_alert(self.store, anomaly, clock.now())
        if alert is not None:
            self.escalate(alert)
        return alert

    def attach_snapshot(self, event: dict[str, Any], ring_ts: datetime) -> None:
        """Doorbell photo + visitor description. Never raises: a missing photo is normal."""
        if self.ring is None:
            return
        image = self.ring.latest_snapshot(event["device_id"], ring_ts)
        if not image:
            return
        ext, content_type = image_type(image)
        key = f"snapshots/{event['home_id']}/{event['event_id']}.{ext}"
        self.store.save_blob(key, image, content_type)
        fields: dict[str, Any] = {"snapshot_key": key}
        if self.settings.visitor_descriptions:
            try:
                fields["visitor"] = engine.describe_visitor(image)
            except Exception:  # Bedrock unavailable/throttled: keep the photo, skip the text
                log.exception("describe_visitor failed for %s", event["event_id"])
        self.store.update_event(event["home_id"], event["ts"], event["event_id"], fields)
