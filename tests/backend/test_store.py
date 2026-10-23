"""One behaviour suite run against both stores: MemoryStore and DynamoStore (moto)."""

from datetime import UTC, date, datetime, timedelta

import boto3
import pytest
from moto import mock_aws

from backend.common.config import load_settings
from backend.common.dynamo_store import DynamoStore, create_tables
from backend.common.memory_store import MemoryStore
from backend.common.timeutil import to_iso

HOME = "home-demo-1"
T0 = datetime(2026, 10, 22, 3, 0, tzinfo=UTC)


@pytest.fixture(params=["memory", "dynamo"])
def store(request, monkeypatch):
    if request.param == "memory":
        yield MemoryStore(load_settings({}))
        return
    for var in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"):
        monkeypatch.setenv(var, "testing")
    settings = load_settings({"STORAGE": "dynamo", "BLOB_BUCKET": "saathi-test"})
    with mock_aws():
        ddb = boto3.resource("dynamodb", region_name="us-east-1")
        s3 = boto3.client("s3", region_name="us-east-1")
        create_tables(ddb, settings)
        s3.create_bucket(Bucket="saathi-test")
        yield DynamoStore(settings, resource=ddb, s3=s3)


def _event(i: int, minutes: int, zone: str = "kitchen") -> dict:
    return {
        "event_id": f"evt_{i}",
        "home_id": HOME,
        "device_id": "dev_kitchen_cam",
        "zone": zone,
        "type": "motion.human",
        "ts": to_iso(T0 + timedelta(minutes=minutes)),
        "snapshot_key": None,
    }


def test_put_event_is_idempotent(store):
    assert store.put_event_if_new(_event(1, 0)) is True
    assert store.put_event_if_new(_event(1, 0)) is False
    assert len(store.query_events(HOME, T0, T0 + timedelta(hours=1))) == 1


def test_query_events_range_is_half_open_and_sorted(store):
    for i, m in enumerate([30, 0, 59, 60, 10]):
        store.put_event_if_new(_event(i, m))
    got = store.query_events(HOME, T0, T0 + timedelta(minutes=60))
    assert [e["ts"] for e in got] == [to_iso(T0 + timedelta(minutes=m)) for m in (0, 10, 30, 59)]
    assert got[0] == _event(1, 0)
    assert store.query_events("other-home", T0, T0 + timedelta(days=1)) == []


def test_update_event_merges_fields(store):
    e = _event(1, 5)
    store.put_event_if_new(e)
    visitor = {"summary": "A courier", "person_count": 1, "caution": False}
    store.update_event(
        HOME, e["ts"], e["event_id"], {"snapshot_key": "s/1.jpg", "visitor": visitor}
    )
    (got,) = store.query_events(HOME, T0, T0 + timedelta(hours=1))
    assert got["snapshot_key"] == "s/1.jpg"
    assert got["visitor"] == visitor


def test_routines_by_zone(store):
    r = {"home_id": HOME, "zone": "kitchen", "hist": [0] * 96, "days_seen": 3, "median_first": 485}
    store.put_routine(r)
    store.put_routine({**r, "zone": "bedroom", "days_seen": 4})
    assert store.get_routine(HOME, "kitchen") == {**r, "rev": 1}
    assert store.get_routine(HOME, "living_room") is None
    routines = store.get_routines(HOME)
    assert set(routines) == {"kitchen", "bedroom"}
    assert routines["bedroom"]["days_seen"] == 4
    assert isinstance(routines["kitchen"]["hist"][0], int)


def test_routine_writes_are_conditional_on_rev(store):
    """H9: a write based on a stale read is rejected instead of silently winning."""
    r = {"home_id": HOME, "zone": "kitchen", "hist": [0] * 96, "days_seen": 3}
    assert store.put_routine(r, expected_rev=0) is True
    stored = store.get_routine(HOME, "kitchen")
    assert stored["rev"] == 1
    assert store.put_routine({**r, "days_seen": 4}, expected_rev=1) is True
    assert store.put_routine({**r, "days_seen": 5}, expected_rev=1) is False  # stale
    assert store.get_routine(HOME, "kitchen")["days_seen"] == 4


def test_redelivered_event_with_a_shifted_ts_is_still_a_duplicate(store):
    """H6: dedupe is on event_id alone, not on ts#event_id."""
    assert store.put_event_if_new(_event(7, 0)) is True
    assert store.put_event_if_new(_event(7, 30)) is False


def test_open_alert_pointer_and_digest_claims(store):
    """H10/H5: only one open alert per home and one digest per day, atomically."""
    store.put_home({"home_id": HOME})
    assert store.claim_open_alert(HOME, "alt_a") is True
    store.put_alert(_alert("alt_a"))
    assert store.claim_open_alert(HOME, "alt_b") is False
    assert store.get_open_alert(HOME)["alert_id"] == "alt_a"
    store.put_alert({**_alert("alt_a"), "state": "RESOLVED"})
    store.release_open_alert(HOME, "alt_a")
    assert store.get_open_alert(HOME) is None
    assert store.claim_open_alert(HOME, "alt_b") is True
    day = date(2026, 10, 22)
    assert store.claim_digest(HOME, day) is True
    assert store.claim_digest(HOME, day) is False
    store.release_digest(HOME, day)
    assert store.claim_digest(HOME, day) is True


def _alert(alert_id: str, state: str = "SUSPECT") -> dict:
    return {
        "alert_id": alert_id,
        "home_id": HOME,
        "kind": "late_start",
        "zone": "kitchen",
        "reason": "No kitchen movement by 10:15 (usually 08:05)",
        "state": state,
        "created_at": "2026-10-22T04:45:00Z",
        "resolved_at": None,
        "acked_by": None,
        "steps": [{"state": "SUSPECT", "at": "2026-10-22T04:45:00Z"}],
    }


def test_alerts_newest_first_and_open_alert(store):
    store.put_alert(_alert("alt_0001", "RESOLVED"))
    store.put_alert(_alert("alt_0003"))
    store.put_alert(_alert("alt_0002", "RESOLVED"))
    assert [a["alert_id"] for a in store.list_alerts(HOME, 2)] == ["alt_0003", "alt_0002"]
    assert store.get_open_alert(HOME)["alert_id"] == "alt_0003"
    assert store.find_alert("alt_0002")["state"] == "RESOLVED"
    assert store.get_alert(HOME, "missing") is None

    store.put_alert(_alert("alt_0003", "RESOLVED"))
    assert store.get_open_alert(HOME) is None
    assert len(store.list_alerts(HOME, 20)) == 3


def test_homes(store):
    home = {
        "home_id": HOME,
        "parent_name": "Kamala",
        "city": "Chennai",
        "devices": {"d1": "kitchen"},
    }
    assert store.get_home(HOME) is None
    store.put_home(home)
    assert store.get_home(HOME) == home


def test_digest_and_blobs(store):
    day = date(2026, 10, 22)
    assert store.get_digest(HOME, day) is None
    rec = store.put_digest(HOME, day, "A calm day.", "2026-10-22T15:30:00Z")
    assert (
        store.get_digest(HOME, day)
        == rec
        == {
            "date": "2026-10-22",
            "text": "A calm day.",
            "generated_at": "2026-10-22T15:30:00Z",
        }
    )
    url = store.save_blob("snapshots/x.jpg", b"\xff\xd8jpeg", "image/jpeg")
    assert "snapshots/x.jpg" in url
    assert store.get_blob("snapshots/x.jpg") == (b"\xff\xd8jpeg", "image/jpeg")
    assert store.get_blob("nope") is None


def test_conditional_alert_put(store):
    store.put_alert(_alert("alt_0001", "SUSPECT"))
    assert store.put_alert(_alert("alt_0001", "NUDGE_PARENT"), expected_state="SUSPECT") is True
    assert store.put_alert(_alert("alt_0001", "RESOLVED"), expected_state="SUSPECT") is False
    assert store.find_alert("alt_0001")["state"] == "NUDGE_PARENT"
    assert store.put_alert(_alert("alt_new"), expected_state="SUSPECT") is False
