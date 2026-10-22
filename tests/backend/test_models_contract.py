"""Guards the shared engine data model (contract 4.3) so accidental edits fail CI."""

from dataclasses import fields
from datetime import UTC, datetime

from backend.engine.models import Anomaly, EngineConfig, Event, Routine


def _names(cls) -> list[str]:
    return [f.name for f in fields(cls)]


def test_event_fields():
    assert _names(Event) == [
        "event_id",
        "home_id",
        "device_id",
        "zone",
        "type",
        "ts",
        "snapshot_key",
    ]
    e = Event("evt_1", "home-demo-1", "dev", "kitchen", "motion.human", datetime.now(UTC))
    assert e.snapshot_key is None


def test_routine_fields():
    assert _names(Routine) == [
        "home_id",
        "zone",
        "hist",
        "days_seen",
        "first_times",
        "median_first",
        "mad_first",
        "last_event_ts",
        "today",
        "today_first",
        "today_slots",
        "day_slots",  # added via contract change request, PR #6
        "fired",  # added in PR #8
    ]


def test_anomaly_fields():
    assert _names(Anomaly) == ["home_id", "kind", "zone", "reason", "detected_at", "details"]


def test_engine_config_defaults():
    cfg = EngineConfig()
    assert (cfg.late_buffer_min_floor, cfg.mad_multiplier, cfg.inactivity_minutes) == (30, 3.0, 240)
    assert (cfg.waking_start, cfg.waking_end, cfg.default_first_activity) == (
        "06:00",
        "22:00",
        "08:00",
    )
    assert (cfg.night_rare_ratio, cfg.min_days_for_checks) == (0.05, 5)


def test_dataclasses_use_slots():
    for cls in (Event, Routine, Anomaly, EngineConfig):
        assert hasattr(cls, "__slots__")
