"""Lambda handlers with API Gateway v2 / EventBridge / Step Functions shaped events."""

import base64
import json

import pytest
from ring_sandbox import webhooks

from backend.api.scheduler import Scheduler
from backend.escalation.base import ImmediateEscalator
from backend.escalation.ladder import LadderCore
from backend.handlers import escalation_step, ingest, runtime, tick
from backend.ingest.service import IngestService
from tests.backend.conftest import device_for, signed
from tests.backend.test_ladder import FakeNotifier, _alert
from tests.backend.test_notify import FakeSfn


@pytest.fixture
def wired(monkeypatch, store, settings, gateway, home):
    service = IngestService(store, settings, ring=gateway)
    sched = Scheduler(store, settings, ImmediateEscalator(store))
    monkeypatch.setattr(runtime, "ingest", lambda: service)
    monkeypatch.setattr(runtime, "scheduler", lambda: sched)
    return store


def _http_event(body: bytes, headers: dict, b64: bool = False) -> dict:
    return {
        "version": "2.0",
        "routeKey": "POST /webhooks/ring",
        "rawPath": "/webhooks/ring",
        "headers": {k.lower(): v for k, v in headers.items()},
        "body": base64.b64encode(body).decode() if b64 else body.decode(),
        "isBase64Encoded": b64,
    }


@pytest.mark.parametrize("b64", [False, True])
def test_ingest_handler_accepts_signed_webhook(wired, home, b64):
    payload = webhooks.build_event(
        event_type="motion_detected", device_id=device_for(home, "kitchen"), sub_type="human"
    )
    body, headers = signed(payload)
    resp = ingest.handler(_http_event(body, headers, b64))
    assert resp["statusCode"] == 200 and json.loads(resp["body"]) == {"ok": True}
    assert wired.event_count("home-demo-1") == 1


def test_ingest_handler_rejects_bad_signature(wired, home):
    body, headers = signed(webhooks.build_event(event_type="button_press", device_id="x"), "nope")
    resp = ingest.handler(_http_event(body, headers))
    assert resp["statusCode"] == 401
    assert json.loads(resp["body"]) == {"detail": "invalid webhook signature"}


def test_tick_handler_returns_summary(wired):
    assert tick.handler({"source": "aws.events"}) == {
        "anomalies": [],
        "alerts": [],
        "rolled_over": 0,
        "digests": 0,
    }


def test_escalation_step_handler(monkeypatch, store):
    store.put_home({"home_id": "home-demo-1", "parent_name": "Kamala", "devices": {}})
    core = LadderCore(store, FakeNotifier())

    class Esc:
        pass

    esc = Esc()
    esc.core = core
    sfn = FakeSfn()
    monkeypatch.setattr(runtime, "escalation", lambda: esc)
    monkeypatch.setattr(escalation_step, "_sfn", lambda: sfn)
    alert = _alert(store)
    event = {"alert_id": alert["alert_id"], "home_id": "home-demo-1", "state": "ALERT_FAMILY"}
    out = escalation_step.handler({**event, "task_token": "tok"})
    assert out == {"alert_id": alert["alert_id"], "state": "ALERT_FAMILY"}
    assert store.find_alert(alert["alert_id"])["task_token"] == "tok"
