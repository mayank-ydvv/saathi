"""Regression tests for the fixes in docs/ERRORS.md (IDs in each test name)."""

from __future__ import annotations

import base64
import json
import time
from datetime import date, timedelta

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from fastapi.testclient import TestClient

from backend.api.auth import Auth, CognitoVerifier
from backend.api.main import create_app
from backend.api.scheduler import Scheduler
from backend.common import clock
from backend.common.config import load_settings
from backend.common.memory_store import MemoryStore
from backend.digest.daily import compute_facts
from backend.digest.visitor import image_format
from backend.engine.models import Anomaly, Event
from backend.escalation.alerts import STALE_AFTER, try_open_alert
from backend.escalation.base import ImmediateEscalator
from backend.escalation.messages import alert_text, greeting
from backend.escalation.telegram import TelegramPoller
from backend.ingest.service import IngestService, image_type
from tests.backend.factories import HOME, at

DAY = date(2026, 10, 22)
POOL, CLIENT, REGION = "ap-south-1_TEST", "client123", "ap-south-1"


def _anomaly(kind="late_start", zone="kitchen", when="10:15"):
    return Anomaly(HOME, kind, zone, f"{kind} reason", at(DAY, when), {})


# --- C1 / C2: API authentication --------------------------------------------------------


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


@pytest.fixture(scope="module")
def keypair():
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pub = key.public_key().public_numbers()
    jwk = {
        "kty": "RSA",
        "kid": "k1",
        "n": _b64(pub.n.to_bytes((pub.n.bit_length() + 7) // 8, "big")),
        "e": _b64(pub.e.to_bytes(3, "big")),
    }
    return key, {"keys": [jwk]}


def _token(key, **overrides) -> str:
    claims = {
        "iss": f"https://cognito-idp.{REGION}.amazonaws.com/{POOL}",
        "aud": CLIENT,
        "token_use": "id",
        "email": "priya@example.com",
        "name": "Priya",
        "exp": time.time() + 600,
        **overrides,
    }
    head = _b64(json.dumps({"alg": "RS256", "kid": "k1"}).encode())
    body = _b64(json.dumps(claims).encode())
    sig = key.sign(f"{head}.{body}".encode(), padding.PKCS1v15(), hashes.SHA256())
    return f"{head}.{body}.{_b64(sig)}"


@pytest.fixture
def secured(keypair, store):
    key, jwks = keypair
    settings = load_settings(
        {
            "RING_WEBHOOK_HMAC_KEY": "k",
            "AUTH_MODE": "cognito",
            "AWS_REGION": REGION,
            "COGNITO_USER_POOL_ID": POOL,
            "COGNITO_CLIENT_ID": CLIENT,
            "PARENT_DEVICE_TOKEN": "tablet-secret",
        }
    )
    store.put_home(
        {"home_id": HOME, "parent_name": "Kamala", "family_emails": ["priya@example.com"]}
    )
    app = create_app(settings, store=store, ring=None, run_background=False)
    app.state.auth = Auth(settings, CognitoVerifier(REGION, POOL, CLIENT, lambda: jwks))
    with TestClient(app) as c:
        yield c, key


def test_c1_data_routes_need_a_valid_family_token(secured):
    api, key = secured
    assert api.get(f"/homes/{HOME}/status").status_code == 401
    assert (
        api.get(f"/homes/{HOME}/status", headers={"Authorization": "Bearer x.y.z"}).status_code
        == 401
    )
    expired = _token(key, exp=time.time() - 3600)
    assert (
        api.get(f"/homes/{HOME}", headers={"Authorization": f"Bearer {expired}"}).status_code == 401
    )
    ok = api.get(f"/homes/{HOME}", headers={"Authorization": f"Bearer {_token(key)}"})
    assert ok.status_code == 200 and ok.json()["parent_name"] == "Kamala"
    assert api.get("/health").status_code == 200  # health stays open


def test_c2_a_signed_up_stranger_cannot_read_the_home(secured):
    api, key = secured
    stranger = _token(key, email="stranger@example.com")
    assert (
        api.get(
            f"/homes/{HOME}/timeline", headers={"Authorization": f"Bearer {stranger}"}
        ).status_code
        == 403
    )


def test_c1_parent_tablet_uses_its_device_token_and_can_only_ack_as_parent(secured, store):
    api, _ = secured
    alert, _ = try_open_alert(store, _anomaly(), at(DAY, "10:15"))
    assert api.get(f"/homes/{HOME}/nudge").status_code == 401
    tablet = {"X-Device-Token": "tablet-secret"}
    assert api.get(f"/homes/{HOME}/nudge", headers=tablet).status_code == 200
    url = f"/alerts/{alert['alert_id']}/ack"
    assert api.post(url, json={"by": "family", "name": "x"}, headers=tablet).status_code == 401
    assert api.post(url, json={"by": "parent", "name": "Kamala"}, headers=tablet).status_code == 200


# --- H1: unanswered alerts expire instead of blocking forever ----------------------------


def test_h1_a_stale_unanswered_alert_no_longer_blocks_new_anomalies(store):
    first, _ = try_open_alert(store, _anomaly(), at(DAY, "10:15"))
    assert first is not None
    blocked, outcome = try_open_alert(
        store, _anomaly("night_activity", "front_door"), at(DAY, "11:00")
    )
    assert blocked is None and outcome == "open"
    later = at(DAY, "10:15") + STALE_AFTER + timedelta(days=2)
    night, outcome = try_open_alert(store, _anomaly("night_activity", "front_door"), later)
    assert outcome == "opened" and night is not None
    old = store.find_alert(first["alert_id"])
    assert old["state"] == "RESOLVED" and old["expired"] is True


# --- H3: ids don't depend on the demo clock ----------------------------------------------


def test_h3_new_alert_is_found_after_the_demo_clock_moves_backwards(store):
    clock.set_offset(timedelta(days=3))
    old, _ = try_open_alert(store, _anomaly(), clock.now())
    ImmediateEscalator(store).ack(old["alert_id"], "family", "Priya")
    clock.reset()
    new, _ = try_open_alert(store, _anomaly("long_inactivity", None), clock.now())
    assert store.get_open_alert(HOME)["alert_id"] == new["alert_id"]


# --- H2: movement resolves a late-start alert --------------------------------------------


def test_h2_indoor_movement_resolves_an_open_late_start_as_the_parent(store, settings):
    store.put_home({"home_id": HOME, "parent_name": "Kamala", "devices": {}})
    alert, _ = try_open_alert(store, _anomaly(), at(DAY, "10:15"))
    esc = ImmediateEscalator(store)
    service = IngestService(store, settings, resolve=esc.ack)
    event = {
        "home_id": HOME,
        "zone": "kitchen",
        "type": "motion.human",
        "ts": "2026-10-22T04:50:00Z",
    }
    service._resolve_if_moving(event, store.get_home(HOME))  # 10:20 IST, after the alert
    stored = store.find_alert(alert["alert_id"])
    assert stored["state"] == "RESOLVED" and stored["acked_by"] == {
        "by": "parent",
        "name": "Kamala",
    }


def test_h2_a_doorbell_visitor_does_not_resolve_it(store, settings):
    store.put_home({"home_id": HOME, "parent_name": "Kamala", "devices": {}})
    alert, _ = try_open_alert(store, _anomaly(), at(DAY, "10:15"))
    service = IngestService(store, settings, resolve=ImmediateEscalator(store).ack)
    event = {
        "home_id": HOME,
        "zone": "front_door",
        "type": "motion.human",
        "ts": "2026-10-22T04:50:00Z",
    }
    service._resolve_if_moving(event, store.get_home(HOME))
    assert store.find_alert(alert["alert_id"])["state"] == "SUSPECT"


# --- H4 / H5: one digest a day, retried after a failure ----------------------------------


def test_h4_h5_digest_failure_is_retried_and_never_sent_twice(store, settings, monkeypatch):
    store.put_home({"home_id": HOME, "parent_name": "Kamala"})
    sent = []
    sched = Scheduler(
        store, settings, ImmediateEscalator(store), on_digest=lambda h, r: sent.append(r)
    )
    calls = {"n": 0}
    real = sched.build_digest

    def flaky(home, day, now):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("transient store error")
        return real(home, day, now)

    monkeypatch.setattr(sched, "build_digest", flaky)
    when = at(DAY, "21:01")
    sched.tick(when)  # fails
    sched.tick(when)  # retried and sent
    sched.tick(when)  # already sent
    other = Scheduler(
        store, settings, ImmediateEscalator(store), on_digest=lambda h, r: sent.append(r)
    )
    assert other.deliver_digest(store.get_home(HOME), DAY, when) is None  # the 21:00 Lambda
    assert len(sent) == 1


# --- M1 / L5: digest facts -----------------------------------------------------------------


def _ev(hhmm: str, zone: str = "kitchen") -> Event:
    return Event(f"e{hhmm}", HOME, "d", zone, "motion.human", at(DAY, hhmm))


def test_m1_the_quiet_after_the_last_event_counts():
    facts = compute_facts(
        {"parent_name": "Ma"}, [_ev("07:00"), _ev("08:00"), _ev("10:00")], [], DAY
    )
    assert facts["longest_quiet_minutes_while_awake"] == 12 * 60  # 10:00 -> 22:00


def test_l5_a_night_kitchen_visit_is_not_a_meal():
    facts = compute_facts({"parent_name": "Ma"}, [_ev("02:00"), _ev("08:00")], [], DAY)
    assert facts["kitchen_visits"] == ["breakfast around 08:00"]


# --- M4: image types -----------------------------------------------------------------------


def test_m4_image_sniffing():
    webp = b"RIFF\x00\x00\x00\x00WEBPVP8 "
    wav = b"RIFF\x00\x00\x00\x00WAVEfmt "
    assert image_format(webp) == "webp" and image_format(wav) is None
    assert image_type(webp) == ("webp", "image/webp")
    assert image_type(b"GIF89a....") == ("gif", "image/gif")


# --- M10: Telegram offset ------------------------------------------------------------------


class FakeTelegram:
    def __init__(self, updates):
        self.updates = updates
        self.offsets = []

    def get_updates(self, offset):
        self.offsets.append(offset)
        return [u for u in self.updates if offset is None or u["update_id"] >= offset]

    def answer_callback(self, *a, **k):
        return None


def test_m10_a_failed_ack_is_retried_not_dropped(monkeypatch):
    import backend.escalation.telegram as tg

    calls = []

    def handle(update, ack, client):
        calls.append(update["update_id"])
        if len(calls) == 1:
            raise RuntimeError("store down")

    monkeypatch.setattr(tg, "handle_update", handle)
    poller = TelegramPoller(FakeTelegram([{"update_id": 5}]), ack=lambda *a: None)
    poller.poll_once()
    poller.poll_once()
    assert calls == [5, 5] and poller._offset == 6


# --- L2 / L4: wording ----------------------------------------------------------------------


def test_l2_l4_night_greeting_and_no_empty_city():
    assert greeting(at(DAY, "02:10")) == "Hello"
    assert greeting(at(DAY, "07:00")) == "Good morning"
    alert = {"state": "ALERT_FAMILY", "reason": "r"}
    assert "()" not in alert_text(alert, {"parent_name": "Ma"}, None)


# --- C3: demo routes never on the DynamoDB API --------------------------------------------


def test_c3_dev_routes_only_with_local_demo_mode(store):
    off = load_settings({"RING_WEBHOOK_HMAC_KEY": "k"})
    with TestClient(create_app(off, store=store, ring=None, run_background=False)) as api:
        assert api.get("/_dev/clock").status_code == 404
    on = load_settings({"RING_WEBHOOK_HMAC_KEY": "k", "DEMO_MODE": "true"})
    with TestClient(create_app(on, store=MemoryStore(on), ring=None, run_background=False)) as api:
        assert api.get("/_dev/clock").status_code == 200


# --- M2: a dropped anomaly can fire again --------------------------------------------------


def test_m2_an_anomaly_blocked_by_an_open_alert_is_not_marked_fired(store, settings):
    from backend.common import engine

    store.put_home({"home_id": HOME, "parent_name": "Kamala"})
    routine = engine.new_routine(HOME, "kitchen")
    routine.today = DAY
    routine.fired["late_start"] = DAY.isoformat()
    store.put_routine(engine.routine_to_dict(routine))
    blocker, _ = try_open_alert(store, _anomaly("night_activity", "front_door"), at(DAY, "09:00"))
    assert blocker is not None
    sched = Scheduler(store, settings, ImmediateEscalator(store))
    routines = {"kitchen": engine.routine_from_dict(store.get_routine(HOME, "kitchen"))}
    sched._unfire(HOME, _anomaly(), DAY, routines)
    assert "late_start" not in store.get_routine(HOME, "kitchen")["fired"]


# --- M3: no Bedrock call when the ingest Lambda is short of time ----------------------------


def test_m3_ingest_lambda_skips_the_description_when_time_is_short(monkeypatch):
    from backend.handlers import ingest as handler
    from backend.ingest.service import IngestResult

    seen = {}

    class Service:
        def handle(self, body, sig):
            event = {"type": "ding", "device_id": "d", "home_id": HOME, "event_id": "e", "ts": "t"}
            return IngestResult("stored", event, None, at(DAY, "10:00"))

        def attach_snapshot(self, event, ring_ts, describe=True):
            seen["describe"] = describe

    class Context:
        def get_remaining_time_in_millis(self):
            return 10_000

    monkeypatch.setattr(handler.runtime, "ingest", lambda: Service())
    assert handler.handler({"body": "{}", "headers": {}}, Context())["statusCode"] == 200
    assert seen["describe"] is False
