"""Saathi's gateway to the Ring Partner API, built on ring-sandbox's typed `RingClient`.

This is the real Ring integration on our code path:
- `list_devices()`   -> GET  /v1/devices?include=capabilities       (seeding: device -> zone)
- `recent_events()`  -> GET  /v1/history/devices/{id}/events         (catch-up / backfill)
- `latest_snapshot()`-> POST /v1/devices/{id}/media/image/download   (doorbell visitor photo)

Locally `RING_API_BASE` points at the ring-sandbox emulator (`ring-sandbox serve`); with a
Ring Playground or production token it points at https://api.amazonvision.com.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

import httpx
from ring_sandbox import PRODUCTION_BASE_URL, RingAPIError, RingClient

from backend.common import clock
from backend.common.config import Settings

log = logging.getLogger(__name__)

# Real Ring media 303-redirects to pre-signed URLs on another host; the emulator redirects
# to its own origin, which RingClient always allows.
# TODO(verify): exact media host for production Ring; "*.amazonaws.com" per ring-sandbox docs.
PRODUCTION_MEDIA_ORIGINS = ("*.amazonaws.com",)
SNAPSHOT_BEFORE = timedelta(seconds=5)
SNAPSHOT_AFTER = timedelta(seconds=60)


@dataclass(frozen=True, slots=True)
class RingDevice:
    id: str
    name: str
    is_camera: bool


@dataclass(frozen=True, slots=True)
class RingHistoryEvent:
    id: str
    type: str  # history names ("motion", "ding", "on_demand") already match contract 4.2
    ts: datetime


class RingGateway:
    """Thin, documented wrapper so the rest of the backend never touches HTTP details."""

    def __init__(
        self,
        base_url: str,
        token: str,
        transport: httpx.BaseTransport | None = None,
        timeout: float = 10.0,
    ) -> None:
        media = PRODUCTION_MEDIA_ORIGINS if base_url.rstrip("/") == PRODUCTION_BASE_URL else ()
        self._client = RingClient(
            token, base_url=base_url, transport=transport, timeout=timeout, media_origins=media
        )

    @classmethod
    def from_settings(cls, settings: Settings) -> RingGateway:
        return cls(settings.ring_api_base, settings.ring_token)

    def close(self) -> None:
        self._client.close()

    def list_devices(self) -> list[RingDevice]:
        """All devices on the account with their camera capability. One request."""
        return [
            RingDevice(
                id=b.id,
                name=b.name,
                is_camera=bool(b.capabilities and b.capabilities.is_camera),
            )
            for b in self._client.devices(include=["capabilities"])
        ]

    def recent_events(self, device_id: str, since: datetime) -> list[RingHistoryEvent]:
        """History newer than `since`, newest first. O(k) over the returned pages."""
        return [
            RingHistoryEvent(
                id=ev.id,
                type=ev.attributes.event_type,
                ts=ev.attributes.started_at,
            )
            for ev in self._client.events(device_id, since=since)
        ]

    def latest_snapshot(self, device_id: str, at: datetime) -> bytes | None:
        """JPEG bytes of the latest frame recorded around `at` (real Ring time), else None.

        Ring answers 416 when nothing was recorded in the window and 503 when the device is
        offline; both mean "no photo", not an error for us.
        """
        start = at - SNAPSHOT_BEFORE
        end = min(at + SNAPSHOT_AFTER, clock.real_now())
        try:
            return self._client.snapshot_latest(device_id, start=start, end=end).content
        except (RingAPIError, httpx.HTTPError) as exc:
            log.warning("no snapshot for %s at %s: %s", device_id, at, exc)
            return None
