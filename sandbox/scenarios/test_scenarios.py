"""Checks that every Saathi scenario loads with ring-sandbox and matches the shared contract.

Run with: pytest sandbox/scenarios
"""

from datetime import UTC, date, datetime
from pathlib import Path

import pytest
from ring_sandbox.scenarios import load_yaml

from sandbox.scenarios.play_day import DEVICES, local_midnight, parse_hhmm, split_at

SCENARIO_DIR = Path(__file__).resolve().parent
NAMES = ["normal_day", "fall_day", "late_morning", "night_door", "scam_visitor", "aide_visit"]
DEVICE_NAMES = {name for _, name, _, _ in DEVICES}
WEBHOOK_TYPES = {"motion_detected", "button_press"}
DAY_S = 24 * 3600


@pytest.mark.parametrize("name", NAMES)
def test_scenario_loads_and_uses_known_devices(name: str) -> None:
    scenario = load_yaml(str(SCENARIO_DIR / f"{name}.yml"))
    assert scenario.name == name
    assert scenario.steps
    for step in scenario.steps:
        assert 0 <= step.offset_s < DAY_S
        assert step.device in DEVICE_NAMES
        assert step.type in WEBHOOK_TYPES


def test_devices_cover_the_four_contract_zones() -> None:
    assert sorted(zone for *_, zone in DEVICES) == sorted(
        ["front_door", "kitchen", "living_room", "bedroom"]
    )


def test_local_midnight_is_ist() -> None:
    assert local_midnight(date(2026, 10, 22)).astimezone(UTC) == datetime(
        2026, 10, 21, 18, 30, tzinfo=UTC
    )


def test_split_at_rebases_later_steps() -> None:
    scenario = load_yaml(str(SCENARIO_DIR / "fall_day.yml"))
    early, late = split_at(scenario, parse_hhmm("12:00"))
    assert len(early.steps) + len(late.steps) == len(scenario.steps)
    assert all(s.offset_s < 12 * 3600 for s in early.steps)
    assert [s.offset_s for s in late.steps] == [45900 - 43200, 46800 - 43200]


def test_fall_day_goes_silent_after_13_00() -> None:
    scenario = load_yaml(str(SCENARIO_DIR / "fall_day.yml"))
    assert max(s.offset_s for s in scenario.steps) == parse_hhmm("13:00")
    assert scenario.steps[-1].device == "Living Room Cam"


def test_night_door_has_a_2am_front_door_person() -> None:
    scenario = load_yaml(str(SCENARIO_DIR / "night_door.yml"))
    night = [s for s in scenario.steps if s.offset_s < parse_hhmm("05:00")]
    assert [(s.device, s.sub_type) for s in night] == [("Front Door", "human")]
