from datetime import UTC, datetime, timedelta

from backend.common.config import load_settings
from backend.common.memory_store import MemoryStore
from backend.engine.models import Anomaly
from backend.escalation.alerts import new_alert_id, open_alert

HOME = "home-demo-1"
NOW = datetime(2026, 10, 22, 4, 50, tzinfo=UTC)  # 10:20 IST


def _anomaly(kind="late_start", zone="kitchen"):
    return Anomaly(HOME, kind, zone, "No kitchen movement by 10:20 (usually 08:05)", NOW, {})


def _resolve(store, alert):
    store.put_alert({**alert, "state": "RESOLVED"})


def test_alert_ids_sort_by_time():
    ids = [new_alert_id(NOW + timedelta(milliseconds=i)) for i in (0, 1, 1000, 86_400_000)]
    assert ids == sorted(ids) and all(i.startswith("alt_") for i in ids)


def test_open_alert_creates_suspect_record():
    store = MemoryStore(load_settings({}))
    alert = open_alert(store, _anomaly(), NOW)
    assert alert == store.get_open_alert(HOME)
    assert alert["state"] == "SUSPECT" and alert["created_at"] == "2026-10-22T04:50:00Z"
    assert alert["steps"] == [{"state": "SUSPECT", "at": "2026-10-22T04:50:00Z"}]
    assert alert["resolved_at"] is None and alert["acked_by"] is None


def test_only_one_open_alert_per_home():
    store = MemoryStore(load_settings({}))
    assert open_alert(store, _anomaly(), NOW) is not None
    assert open_alert(store, _anomaly("long_inactivity", None), NOW) is None


def test_resolved_late_start_is_not_raised_again_same_day():
    store = MemoryStore(load_settings({}))
    _resolve(store, open_alert(store, _anomaly(), NOW))
    assert open_alert(store, _anomaly(), NOW + timedelta(minutes=1)) is None
    assert open_alert(store, _anomaly(zone="bedroom"), NOW + timedelta(minutes=1)) is not None


def test_late_start_can_alert_again_next_local_day():
    store = MemoryStore(load_settings({}))
    _resolve(store, open_alert(store, _anomaly(), NOW))
    assert open_alert(store, _anomaly(), NOW + timedelta(days=1)) is not None


def test_night_activity_repeats_after_thirty_minutes():
    store = MemoryStore(load_settings({}))
    night = _anomaly("night_activity", "front_door")
    _resolve(store, open_alert(store, night, NOW))
    assert open_alert(store, night, NOW + timedelta(minutes=10)) is None
    assert open_alert(store, night, NOW + timedelta(minutes=31)) is not None
