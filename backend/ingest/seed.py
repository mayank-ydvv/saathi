"""Create/refresh the demo home from the Ring device list, and load backfilled routines.

Idempotent: re-running keeps user-edited fields (e.g. digest_time) and only refreshes the
device -> zone map and contacts.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from backend.common import engine
from backend.common.config import DEMO_HOME_ID, ZONES, Settings
from backend.common.store import Store
from backend.ingest.ring_client import RingDevice, RingGateway

log = logging.getLogger(__name__)

# Checked in order; the first keyword found in the lower-cased device name wins.
ZONE_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("kitchen", "kitchen"),
    ("living", "living_room"),
    ("lounge", "living_room"),
    ("bed", "bedroom"),
    ("door", "front_door"),
    ("front", "front_door"),
)
# The emulator's default world has no indoor cameras; the demo adds these.
DEMO_CAMERAS = ("Kitchen Cam", "Living Room Cam", "Bedroom Cam")
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


def zone_for(device: RingDevice) -> str | None:
    """Zone for a camera/doorbell by name keyword; non-cameras (chimes, sensors) get None."""
    if not device.is_camera:
        return None
    name = device.name.lower()
    return next((zone for word, zone in ZONE_KEYWORDS if word in name), None)


def ensure_demo_cameras(
    ring_api_base: str, existing: list[RingDevice], http: httpx.Client | None = None
) -> list[str]:
    """Add the indoor demo cameras through the emulator control plane (local emulator only)."""
    if urlparse(ring_api_base).hostname not in LOCAL_HOSTS:
        return []
    names = {d.name for d in existing}
    post = http.post if http is not None else httpx.post
    added = []
    for name in DEMO_CAMERAS:
        if name not in names:
            resp = post(
                f"{ring_api_base}/_sandbox/devices",
                json={"kind": "camera", "name": name},
                timeout=10,
            )
            resp.raise_for_status()
            added.append(name)
    return added


def build_home(
    devices: list[RingDevice],
    settings: Settings,
    existing: dict[str, Any] | None,
    home_id: str = DEMO_HOME_ID,
) -> dict[str, Any]:
    home = dict(existing or {})
    home.update(
        {
            "home_id": home_id,  # not always home-demo-1 (L10)
            # Who may read this home through the API (C2); kept if already set.
            "family_emails": sorted(
                set(home.get("family_emails") or []) | set(settings.family_emails)
            ),
            "parent_name": home.get("parent_name", "Kamala"),
            "city": home.get("city", "Chennai"),
            "devices": {d.id: z for d in devices if (z := zone_for(d))},
            "contacts": {
                "family": {
                    "name": settings.family_name,
                    "telegram_chat_id": settings.telegram_family_chat_id,
                },
                "neighbour": {
                    "name": settings.neighbour_name,
                    "telegram_chat_id": settings.telegram_neighbour_chat_id,
                },
            },
            "digest_time": home.get("digest_time", "21:00"),
        }
    )
    return home


def seed_home(
    store: Store,
    ring: RingGateway,
    settings: Settings,
    add_demo_cameras: bool = True,
    http: httpx.Client | None = None,
) -> dict[str, Any]:
    """List devices via RingClient, map them to zones, and upsert the first HOME_IDS home."""
    home_id = settings.home_ids[0] if settings.home_ids else DEMO_HOME_ID
    devices = ring.list_devices()
    if add_demo_cameras and ensure_demo_cameras(settings.ring_api_base, devices, http):
        devices = ring.list_devices()
    home = build_home(devices, settings, store.get_home(home_id), home_id)
    store.put_home(home)
    log.info("seeded %s with zones %s", home_id, sorted(set(home["devices"].values())))
    return home


def load_routines(store: Store, path: str | Path, home_id: str = DEMO_HOME_ID) -> int:
    """Load backfill output (`{zone: routine_dict}` or `[routine_dict, ...]`). Returns count.

    Each record is round-tripped through the engine so bad files fail loudly here.
    """
    p = Path(path)
    if not p.is_file():
        return 0
    data = json.loads(p.read_text())
    records = data.values() if isinstance(data, dict) else data
    count = 0
    for rec in records:
        rec = {**rec, "home_id": rec.get("home_id", home_id)}
        if rec.get("zone") not in ZONES:
            continue
        store.put_routine(engine.routine_to_dict(engine.routine_from_dict(rec)))
        count += 1
    return count
