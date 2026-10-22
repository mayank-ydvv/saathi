from datetime import UTC, datetime, timedelta

import pytest
from ring_sandbox import WebhookEvent, webhooks

from backend.ingest.normalize import make_event_id, normalize, normalize_type

HOME = {"home_id": "home-demo-1", "devices": {"dev_kitchen_cam": "kitchen"}}
AT = datetime(2026, 10, 22, 3, 15, tzinfo=UTC)


def _wh(event_type="motion_detected", sub_type="human", device="dev_kitchen_cam"):
    payload = webhooks.build_event(
        event_type=event_type, device_id=device, occurred_at=AT, sub_type=sub_type
    )
    return WebhookEvent.model_validate(payload)


@pytest.mark.parametrize(
    ("event_type", "sub_type", "expected"),
    [
        ("motion_detected", "human", "motion.human"),
        ("motion_detected", "vehicle", "vehicle"),
        ("motion_detected", "package", "package"),
        ("motion_detected", "animal", "motion"),
        ("motion_detected", None, "motion"),
        ("button_press", None, "ding"),
        ("contact_sensor_faulted", None, "contact_sensor_faulted"),
    ],
)
def test_normalize_type(event_type, sub_type, expected):
    assert normalize_type(event_type, sub_type) == expected


def test_normalize_builds_contract_event():
    wh = _wh()
    assert normalize(wh, HOME) == {
        "event_id": make_event_id(wh.data.id),
        "home_id": "home-demo-1",
        "device_id": "dev_kitchen_cam",
        "zone": "kitchen",
        "type": "motion.human",
        "ts": "2026-10-22T03:15:00Z",
        "snapshot_key": None,
    }


def test_event_id_is_deterministic_and_short():
    wh = _wh()
    assert make_event_id(wh.data.id) == make_event_id(wh.data.id)
    assert make_event_id(wh.data.id).startswith("evt_") and len(make_event_id("x")) == 20


def test_unmapped_device_is_ignored():
    assert normalize(_wh(device="dev_backyard"), HOME) is None


def test_demo_clock_shift_applies_to_ts():
    event = normalize(_wh(), HOME, shift=lambda ts: ts + timedelta(hours=2))
    assert event["ts"] == "2026-10-22T05:15:00Z"
