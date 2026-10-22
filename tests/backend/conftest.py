"""Backend fixtures. The Ring emulator runs in-process through ring-sandbox's pytest plugin
(`ring_world`, `ring_transport`, `ring_control`): no sockets, no real Ring account."""

from __future__ import annotations

import httpx
import pytest
from ring_sandbox import webhooks

from backend.common import clock
from backend.common.config import load_settings
from backend.common.memory_store import MemoryStore
from backend.ingest.ring_client import RingGateway

HMAC_KEY = "test-hmac-key"
RING_BASE = "http://localhost:8787"


@pytest.fixture(autouse=True)
def _no_aws(monkeypatch):
    """Never reach real AWS from tests: no credentials, no instance-metadata lookups."""
    monkeypatch.setenv("AWS_EC2_METADATA_DISABLED", "true")
    for var in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_PROFILE"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("AWS_SHARED_CREDENTIALS_FILE", "/nonexistent")
    monkeypatch.setenv("AWS_CONFIG_FILE", "/nonexistent")


@pytest.fixture(autouse=True)
def _reset_clock():
    clock.reset()
    yield
    clock.reset()


@pytest.fixture
def settings():
    return load_settings({"RING_WEBHOOK_HMAC_KEY": HMAC_KEY, "RING_API_BASE": RING_BASE})


@pytest.fixture
def store(settings):
    return MemoryStore(settings)


@pytest.fixture
def gateway(ring_transport):
    gw = RingGateway(RING_BASE, "sandbox-token", transport=ring_transport)
    yield gw
    gw.close()


@pytest.fixture
def control(ring_transport):
    """Emulator control plane (`/_sandbox/*`) on the same in-process world."""
    with httpx.Client(base_url=RING_BASE, transport=ring_transport) as c:
        yield c


@pytest.fixture
def home(store, gateway, settings, control):
    """`home-demo-1` seeded from the emulator's device list (adds the indoor cameras)."""
    from backend.ingest.seed import seed_home

    return seed_home(store, gateway, settings, http=control)


def device_for(home: dict, zone: str) -> str:
    return next(d for d, z in home["devices"].items() if z == zone)


def signed(payload: dict, key: str = HMAC_KEY) -> tuple[bytes, dict[str, str]]:
    body = webhooks.encode(payload)
    return body, {"Content-Type": "application/json", "X-Signature": webhooks.sign(key, body)}
