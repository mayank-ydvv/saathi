"""Every REST endpoint returns exactly the contract 4.6 shape."""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from ring_sandbox import webhooks

from backend.api.main import create_app
from backend.common import clock, engine
from backend.common.timeutil import to_iso
from backend.engine.models import Anomaly
from backend.escalation.alerts import alert_from_anomaly
from tests.backend.conftest import device_for, signed
from tests.backend.factories import HOME, at, normal_days

DAY = date(2026, 10, 21)
ALERT_KEYS = {
    "alert_id",
    "home_id",
    "kind",
    "zone",
    "reason",
    "state",
    "created_at",
    "resolved_at",
    "acked_by",
    "steps",
}


@pytest.fixture
def api(settings, store, gateway, home):
    app = create_app(settings, store=store, ring=gateway, run_background=False)
    with TestClient(app) as c:
        yield c


def _post_event(api, home, zone, when, event_type="motion_detected", sub_type="human"):
    payload = webhooks.build_event(
        event_type=event_type, device_id=device_for(home, zone), occurred_at=when, sub_type=sub_type
    )
    body, headers = signed(payload)
    assert api.post("/webhooks/ring", content=body, headers=headers).status_code == 200


def _put_alert(store, state="SUSPECT", minutes=0):
    anomaly = Anomaly(
        HOME, "late_start", "kitchen", "No kitchen movement by 10:15", at(DAY, "10:15"), {}
    )
    alert = alert_from_anomaly(anomaly, at(DAY, "10:15") + timedelta(minutes=minutes))
    alert["state"] = state
    alert["steps"].append({"state": state, "at": alert["created_at"]})
    store.put_alert(alert)
    return alert


def test_health(api):
    assert api.get("/health").json() == {"ok": True}


def test_home(api):
    assert api.get(f"/homes/{HOME}").json() == {
        "home_id": HOME,
        "parent_name": "Kamala",
        "city": "Chennai",
        "zones": ["front_door", "kitchen", "living_room", "bedroom"],
        "contacts": [{"role": "family", "name": "Priya"}, {"role": "neighbour", "name": "Ravi"}],
        "parent_phone": None,
    }


def test_home_parent_phone(api, store, home):
    store.put_home({**home, "parent_phone": "+91 98765 43210"})
    assert api.get(f"/homes/{HOME}").json()["parent_phone"] == "+91 98765 43210"


def test_unknown_home_is_404_with_string_detail(api):
    resp = api.get("/homes/nope/status")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "home nope not found"}


def test_status_green_then_last_seen(api, home):
    assert api.get(f"/homes/{HOME}/status").json() == {
        "home_id": HOME,
        "status": "green",
        "reason": None,
        "last_seen": None,
        "active_alert_id": None,
    }
    _post_event(api, home, "kitchen", at(DAY, "08:05"))
    body = api.get(f"/homes/{HOME}/status").json()
    assert body["last_seen"] == {"zone": "kitchen", "ts": to_iso(at(DAY, "08:05"))}


@pytest.mark.parametrize(
    ("state", "colour"),
    [
        ("SUSPECT", "yellow"),
        ("NUDGE_PARENT", "yellow"),
        ("ALERT_FAMILY", "red"),
        ("ALERT_NEIGHBOUR", "red"),
    ],
)
def test_status_colour_follows_open_alert(api, store, state, colour):
    alert = _put_alert(store, state)
    body = api.get(f"/homes/{HOME}/status").json()
    assert body["status"] == colour
    assert body["active_alert_id"] == alert["alert_id"]
    assert body["reason"] == alert["reason"]


def test_timeline_uses_ist_day_bounds_and_sorts(api, home):
    _post_event(api, home, "kitchen", at(DAY, "23:59"))
    _post_event(api, home, "bedroom", at(DAY, "00:01"))
    _post_event(api, home, "kitchen", at(DAY + timedelta(days=1), "00:01"))  # next IST day
    body = api.get(f"/homes/{HOME}/timeline", params={"date": DAY.isoformat()}).json()
    assert body["date"] == "2026-10-21"
    assert [e["zone"] for e in body["events"]] == ["bedroom", "kitchen"]
    assert body["events"][0]["ts"] == "2026-10-20T18:31:00Z"
    assert set(body["events"][0]) == {"event_id", "ts", "zone", "type", "snapshot_url", "visitor"}
    assert body["events"][0]["snapshot_url"] is None and body["events"][0]["visitor"] is None


def test_timeline_bad_date_is_422(api):
    resp = api.get(f"/homes/{HOME}/timeline", params={"date": "21-10-2026"})
    assert resp.status_code == 422 and isinstance(resp.json()["detail"], str)


def test_alerts_newest_first_with_limit(api, store):
    old = _put_alert(store, "RESOLVED", minutes=0)
    new = _put_alert(store, "SUSPECT", minutes=5)
    body = api.get(f"/homes/{HOME}/alerts", params={"limit": 1}).json()
    assert [a["alert_id"] for a in body["alerts"]] == [new["alert_id"]]
    both = api.get(f"/homes/{HOME}/alerts").json()["alerts"]
    assert [a["alert_id"] for a in both] == [new["alert_id"], old["alert_id"]]
    assert set(both[0]) == ALERT_KEYS


def test_ack_resolves_and_is_idempotent(api, store):
    alert = _put_alert(store, "ALERT_FAMILY")
    url = f"/alerts/{alert['alert_id']}/ack"
    resp = api.post(url, json={"by": "family", "name": "Priya"})
    assert resp.json() == {"alert_id": alert["alert_id"], "state": "RESOLVED"}
    again = api.post(url, json={"by": "neighbour", "name": "Ravi"})
    assert again.status_code == 200 and again.json()["state"] == "RESOLVED"
    stored = store.find_alert(alert["alert_id"])
    assert stored["acked_by"] == {"by": "family", "name": "Priya"}
    assert stored["resolved_at"] is not None and stored["steps"][-1]["state"] == "RESOLVED"
    assert api.get(f"/homes/{HOME}/status").json()["status"] == "green"


def test_ack_errors(api, store):
    assert (
        api.post("/alerts/alt_missing/ack", json={"by": "family", "name": "P"}).status_code == 404
    )
    alert = _put_alert(store)
    bad = api.post(f"/alerts/{alert['alert_id']}/ack", json={"by": "stranger", "name": "X"})
    assert bad.status_code == 422 and isinstance(bad.json()["detail"], str)


def test_digest_404_then_shape(api, store):
    assert api.get(f"/homes/{HOME}/digest", params={"date": "2026-10-21"}).status_code == 404
    store.put_digest(HOME, DAY, "Kamala had a calm day.", "2026-10-21T15:30:00Z")
    assert api.get(f"/homes/{HOME}/digest", params={"date": "2026-10-21"}).json() == {
        "date": "2026-10-21",
        "text": "Kamala had a calm day.",
        "generated_at": "2026-10-21T15:30:00Z",
    }


def test_routine_shape(api, store):
    for r in engine.build_routines(normal_days(DAY - timedelta(days=14))).values():
        engine.rollover_day(r, DAY)
        store.put_routine(engine.routine_to_dict(r))
    zones = api.get(f"/homes/{HOME}/routine").json()["zones"]
    assert [z["zone"] for z in zones] == ["front_door", "kitchen", "living_room", "bedroom"]
    kitchen = zones[1]
    assert set(kitchen) == {"zone", "usual_first", "hist", "days_seen"}
    assert kitchen["usual_first"] == "08:05" and kitchen["days_seen"] == 14
    assert len(kitchen["hist"]) == 96 and all(isinstance(x, int) for x in kitchen["hist"])


def test_routine_without_history(api):
    zones = api.get(f"/homes/{HOME}/routine").json()["zones"]
    assert zones[0] == {"zone": "front_door", "usual_first": None, "hist": [0] * 96, "days_seen": 0}


def test_nudge_inactive_then_active(api, store):
    assert api.get(f"/homes/{HOME}/nudge").json() == {
        "active": False,
        "alert_id": None,
        "message": None,
        "audio_url": None,
    }
    _put_alert(store, "SUSPECT")
    assert api.get(f"/homes/{HOME}/nudge").json()["active"] is False
    alert = _put_alert(store, "NUDGE_PARENT", minutes=1)
    body = api.get(f"/homes/{HOME}/nudge").json()
    assert body["active"] is True and body["alert_id"] == alert["alert_id"]
    assert body["message"] == "Good morning Kamala, are you okay? Please press the green button."


def test_cors_allows_both_frontends(api):
    for origin in ("http://localhost:5173", "http://localhost:5174"):
        resp = api.get("/health", headers={"Origin": origin})
        assert resp.headers["access-control-allow-origin"] == origin
    assert (
        "access-control-allow-origin"
        not in api.get("/health", headers={"Origin": "http://evil.example"}).headers
    )


def test_dev_clock_and_tick(api):
    body = api.post("/_dev/clock", json={"local": "10:20", "day": "2026-10-22"}).json()
    assert body["local"].startswith("2026-10-22 10:20")
    assert api.post("/_dev/tick").json()["alerts"] == []
    assert api.post("/_dev/clock", json={"reset": True}).json()["offset_seconds"] == 0
    assert clock.offset() == timedelta(0)


def test_dev_seed_and_blob_route(api, store, tmp_path):
    body = api.post("/_dev/seed", json={"routines_file": str(tmp_path / "none.json")}).json()
    assert body["routines_loaded"] == 0 and body["home"]["home_id"] == HOME
    store.save_blob("snapshots/x.png", b"\x89PNGdata", "image/png")
    resp = api.get("/blobs/snapshots/x.png")
    assert resp.content == b"\x89PNGdata" and resp.headers["content-type"] == "image/png"
    assert api.get("/blobs/missing").status_code == 404
