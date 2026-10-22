"""POST /webhooks/ring: HMAC, idempotency, normalization, night alert, doorbell snapshot."""

from datetime import timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from ring_sandbox import webhooks

from backend.common import engine
from backend.common.timeutil import to_iso
from backend.ingest.service import IngestService
from backend.ingest.webhook import router
from tests.backend.conftest import device_for, signed
from tests.backend.factories import HOME, at, normal_days


@pytest.fixture
def escalated():
    return []


@pytest.fixture
def client(store, settings, gateway, escalated):
    app = FastAPI()
    app.include_router(router)
    app.state.ingest = IngestService(store, settings, ring=gateway, escalate=escalated.append)
    with TestClient(app) as c:
        yield c


def _payload(home, zone, when, event_type="motion_detected", sub_type="human"):
    return webhooks.build_event(
        event_type=event_type,
        device_id=device_for(home, zone),
        occurred_at=when,
        sub_type=sub_type,
    )


def _today_ist():
    from backend.common import clock
    from backend.common.timeutil import local_date

    return local_date(clock.now())


def test_valid_signature_stores_event(client, home, store):
    when = at(_today_ist(), "00:01")
    body, headers = signed(_payload(home, "kitchen", when))
    resp = client.post("/webhooks/ring", content=body, headers=headers)
    assert resp.status_code == 200 and resp.json() == {"ok": True}
    (event,) = store.query_events(HOME, when - timedelta(minutes=1), when + timedelta(minutes=1))
    assert event["zone"] == "kitchen" and event["type"] == "motion.human"
    assert event["ts"] == to_iso(when)
    assert store.get_routine(HOME, "kitchen") is not None


def test_bad_or_missing_signature_is_401(client, home, store):
    body, headers = signed(_payload(home, "kitchen", at(_today_ist(), "00:01")), key="wrong")
    assert client.post("/webhooks/ring", content=body, headers=headers).status_code == 401
    del headers["X-Signature"]
    resp = client.post("/webhooks/ring", content=body, headers=headers)
    assert resp.status_code == 401
    assert resp.json() == {"detail": "invalid webhook signature"}
    assert store.event_count(HOME) == 0


def test_tampered_body_is_401(client, home):
    body, headers = signed(_payload(home, "kitchen", at(_today_ist(), "00:01")))
    tampered = body.replace(b"human", b"vehicle")
    assert client.post("/webhooks/ring", content=tampered, headers=headers).status_code == 401


def test_malformed_body_with_valid_signature_is_400(client):
    body = b'{"not": "a ring webhook"}'
    headers = {"X-Signature": webhooks.sign("test-hmac-key", body)}
    assert client.post("/webhooks/ring", content=body, headers=headers).status_code == 400


def test_duplicate_delivery_is_ignored(client, home, store):
    body, headers = signed(_payload(home, "kitchen", at(_today_ist(), "00:01")))
    for _ in range(3):  # Ring retries with the same event
        assert client.post("/webhooks/ring", content=body, headers=headers).status_code == 200
    assert store.event_count(HOME) == 1


def test_unmapped_device_is_accepted_but_not_stored(client, home, store, gateway):
    backyard = next(d for d in gateway.list_devices() if d.name == "Backyard")
    payload = webhooks.build_event(
        event_type="motion_detected", device_id=backyard.id, sub_type="human"
    )
    body, headers = signed(payload)
    assert client.post("/webhooks/ring", content=body, headers=headers).status_code == 200
    assert store.event_count(HOME) == 0


def _learn_normal_routine(store, today):
    for routine in engine.build_routines(normal_days(today - timedelta(days=14))).values():
        engine.rollover_day(routine, today)
        store.put_routine(engine.routine_to_dict(routine))


def test_night_front_door_opens_one_alert(client, home, store, escalated):
    today = _today_ist()
    _learn_normal_routine(store, today)
    first = at(today, "02:10")
    for minute in (0, 1):  # door opens twice within a minute: still one alert
        body, headers = signed(_payload(home, "front_door", first + timedelta(minutes=minute)))
        assert client.post("/webhooks/ring", content=body, headers=headers).status_code == 200

    (alert,) = store.list_alerts(HOME)
    assert alert["kind"] == "night_activity" and alert["zone"] == "front_door"
    assert alert["state"] == "SUSPECT" and alert["reason"].startswith("Front door opened at 02:10")
    assert alert["steps"][0]["state"] == "SUSPECT"
    assert [a["alert_id"] for a in escalated] == [alert["alert_id"]]


def test_daytime_kitchen_motion_raises_nothing(client, home, store, escalated):
    today = _today_ist()
    _learn_normal_routine(store, today)
    body, headers = signed(_payload(home, "kitchen", at(today, "08:05")))
    client.post("/webhooks/ring", content=body, headers=headers)
    assert store.list_alerts(HOME) == [] and escalated == []


def test_doorbell_ding_saves_snapshot_and_visitor(client, home, store, control):
    door = device_for(home, "front_door")
    when = at(_today_ist(), "00:02")
    # Record the ding in emulator history (so Ring has a frame), then deliver it ourselves.
    resp = control.post(
        "/_sandbox/events",
        json={"device_id": door, "type": "button_press", "at": when.isoformat(), "deliver": False},
    )
    body, headers = signed(resp.json()["webhook"])
    assert client.post("/webhooks/ring", content=body, headers=headers).status_code == 200

    (event,) = store.query_events(HOME, when - timedelta(minutes=1), when + timedelta(minutes=1))
    assert event["type"] == "ding"
    assert event["snapshot_key"] == f"snapshots/{HOME}/{event['event_id']}.png"  # emulator PNG
    assert store.get_blob(event["snapshot_key"])[1] == "image/png"
    assert set(event["visitor"]) >= {"summary", "person_count", "caution"}
