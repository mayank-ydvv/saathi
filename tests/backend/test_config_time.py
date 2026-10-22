from datetime import UTC, date, datetime, timedelta

import pytest

from backend.common import clock
from backend.common.config import DEMO_WAITS, load_settings
from backend.common.timeutil import (
    hhmm,
    local_day_bounds,
    parse_hhmm,
    parse_iso,
    slot_index,
    to_iso,
)


def test_settings_defaults_and_demo_waits():
    s = load_settings({})
    assert s.storage == "memory"
    assert s.home_ids == ["home-demo-1"]
    assert s.waits == DEMO_WAITS
    assert s.table("events") == "saathi-events"


def test_settings_production_waits_from_env():
    s = load_settings(
        {
            "DEMO_MODE": "false",
            "ESC_WAIT_SUSPECT": "1",
            "ESC_WAIT_NUDGE": "2",
            "ESC_WAIT_FAMILY": "3",
            "HOME_IDS": "a, b",
            "TABLE_PREFIX": "dev-",
        }
    )
    assert s.waits == {"SUSPECT": 1, "NUDGE_PARENT": 2, "ALERT_FAMILY": 3}
    assert s.home_ids == ["a", "b"]
    assert s.table("alerts") == "dev-saathi-alerts"


def test_iso_round_trip():
    dt = datetime(2026, 10, 22, 3, 15, 7, 123000, tzinfo=UTC)
    assert to_iso(dt) == "2026-10-22T03:15:07Z"
    assert parse_iso("2026-10-22T03:15:07Z") == dt.replace(microsecond=0)
    assert parse_iso("2026-10-22T08:45:07+05:30") == dt.replace(microsecond=0)


def test_local_day_bounds_are_ist_midnights():
    start, end = local_day_bounds(date(2026, 10, 22))
    assert to_iso(start) == "2026-10-21T18:30:00Z"
    assert to_iso(end) == "2026-10-22T18:30:00Z"


@pytest.mark.parametrize(
    ("utc", "slot"),
    [("2026-10-21T18:30:00Z", 0), ("2026-10-22T03:15:00Z", 35), ("2026-10-22T18:29:59Z", 95)],
)
def test_slot_index_uses_local_time(utc, slot):
    assert slot_index(parse_iso(utc)) == slot


def test_hhmm_helpers():
    assert hhmm(485) == "08:05"
    assert hhmm(None) is None
    assert parse_hhmm("22:00") == 1320


def test_demo_clock_offset_and_shift():
    try:
        now = clock.set_local_time("10:20", day=date(2026, 10, 22))
        assert to_iso(now)[:16] == "2026-10-22T04:50"
        real = clock.real_now()
        assert abs(clock.shift(real) - clock.now()) < timedelta(seconds=1)
    finally:
        clock.reset()
    assert clock.offset() == timedelta(0)
