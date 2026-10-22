"""RingGateway against the in-process ring-sandbox emulator (real RingClient HTTP calls)."""

from datetime import UTC, datetime, timedelta

from ring_sandbox import RingAPIError

from backend.ingest.seed import zone_for


def test_list_devices_reports_cameras(gateway):
    devices = {d.name: d for d in gateway.list_devices()}
    assert devices["Front Door"].is_camera
    assert not devices["Kitchen Chime"].is_camera
    assert zone_for(devices["Front Door"]) == "front_door"
    assert zone_for(devices["Kitchen Chime"]) is None  # chimes never map to a zone
    assert zone_for(devices["Front Door Sensor"]) is None


def test_recent_events_and_snapshot(gateway, control):
    door = next(d for d in gateway.list_devices() if d.name == "Front Door")
    at = datetime.now(UTC) - timedelta(minutes=5)
    resp = control.post(
        "/_sandbox/events",
        json={"device_id": door.id, "type": "button_press", "at": at.isoformat(), "deliver": False},
    )
    resp.raise_for_status()

    events = gateway.recent_events(door.id, since=at - timedelta(minutes=1))
    assert [e.type for e in events] == ["ding"]

    image = gateway.latest_snapshot(door.id, at)
    assert image and len(image) > 100


def test_snapshot_is_none_when_ring_has_no_media(gateway, monkeypatch):
    # Real Ring (and ring-sandbox main) answer 416 TIMESTAMP_NOT_FOUND for an empty window.
    # The published 0.5.0 wheel returns a frame anyway, so simulate the real API here.
    def no_media(*args, **kwargs):
        raise RingAPIError(416, [], "no media in requested range")

    monkeypatch.setattr(gateway._client, "snapshot_latest", no_media)
    assert gateway.latest_snapshot("any-device", datetime.now(UTC)) is None
