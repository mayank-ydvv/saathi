"""Webhook ingest pipeline, independent of FastAPI so Lambda and tests can call it directly.

handle(): verify HMAC -> parse -> find the home -> normalize -> idempotent store ->
          night check -> update routine -> open an alert and start escalation.
Movement indoors also resolves an open late-start / long-inactivity alert as the parent
(she is clearly up), so the ladder doesn't go on to the family and neighbour (H2).
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
from backend.common.routine_store import update_routine
from backend.common.store import Store
from backend.common.timeutil import local_date, parse_iso
from backend.engine.models import EngineConfig
from backend.escalation.alerts import try_open_alert
from backend.ingest.normalize import normalize, occurred_at
from backend.ingest.ring_client import RingGateway

log = logging.getLogger(__name__)

# The emulator stamps meta.time at send; reject captured deliveries replayed much later.
MAX_DELIVERY_AGE_S = 3600


# Events that show the parent is up and about: indoor movement (the front door camera also
# sees visitors and couriers, so it doesn't count).
PARENT_MOVING_TYPES = frozenset({"motion.human", "motion"})
SELF_RESOLVING_KINDS = frozenset({"late_start", "long_inactivity"})


def image_type(data: bytes) -> tuple[str, str]:
    """(extension, MIME) from magic bytes (M4): the emulator serves PNG, Ring JPEG."""
    if data.startswith(b"\x89PNG"):
        return "png", "image/png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif", "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp", "image/webp"
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
        resolve: Callable[[str, str, str], Any] | None = None,
    ) -> None:
        self.store = store
        self.settings = settings
        self.ring = ring
        self.escalate = escalate or (lambda alert: None)
        self.resolve = resolve  # escalator.ack(alert_id, by, name)
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
        self._resolve_if_moving(event, home)
        return IngestResult("stored", event, alert, occurred_at(wh))

    def _resolve_if_moving(self, event: dict[str, Any], home: dict[str, Any]) -> None:
        """H2: indoor movement after a late-start/inactivity alert opened ends it as the
        parent. O(1): one pointer read and, rarely, one resolve."""
        if self.resolve is None or event["type"] not in PARENT_MOVING_TYPES:
            return
        if event["zone"] == "front_door":
            return
        alert = self.store.get_open_alert(event["home_id"])
        if alert is None or alert["kind"] not in SELF_RESOLVING_KINDS:
            return
        if parse_iso(event["ts"]) <= parse_iso(alert["created_at"]):
            return
        try:
            self.resolve(alert["alert_id"], "parent", home.get("parent_name") or "Parent")
        except Exception:  # never fail the webhook over this; the ladder carries on
            log.exception("auto-resolve of %s failed", alert["alert_id"])

    def _learn_and_check(self, event: dict[str, Any]) -> dict[str, Any] | None:
        """Night check against history *before* this event, then fold the event in. The
        routine write is conditional (H9), so a concurrent tick can't lose this update."""
        ev = event_from_dict(event)

        def change(routine):
            anomaly = engine.check_event(routine, ev, self.cfg)
            engine.update_on_event(routine, ev)
            return anomaly

        _, anomaly = update_routine(self.store, ev.home_id, ev.zone, change)
        if anomaly is None:
            return None
        alert, outcome = try_open_alert(self.store, anomaly, clock.now())
        if alert is not None:
            self.escalate(alert)
        elif outcome == "open":  # M2: blocked by another alert, so let it fire again later
            day = local_date(ev.ts).isoformat()

            def unfire(routine):
                if routine.fired.get(anomaly.kind) == day:
                    del routine.fired[anomaly.kind]

            update_routine(self.store, ev.home_id, ev.zone, unfire)
        return alert

    def attach_snapshot(
        self, event: dict[str, Any], ring_ts: datetime, describe: bool = True
    ) -> None:
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
        if self.settings.visitor_descriptions and describe:
            try:
                fields["visitor"] = engine.describe_visitor(image)
            except Exception:  # Bedrock unavailable/throttled: keep the photo, skip the text
                log.exception("describe_visitor failed for %s", event["event_id"])
        self.store.update_event(event["home_id"], event["ts"], event["event_id"], fields)
