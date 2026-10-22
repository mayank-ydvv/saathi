"""The stub must behave sensibly so the backend can be demoed before the real engine lands."""

from datetime import date, timedelta

from backend.common import engine_stub as stub
from backend.engine.models import EngineConfig
from tests.backend.factories import at, event, normal_days

CFG = EngineConfig()
TODAY = date(2026, 10, 22)


def _routines():
    routines = stub.build_routines(normal_days(TODAY - timedelta(days=14)))
    for r in routines.values():
        stub.rollover_day(r, TODAY)
    return routines


def test_build_routines_learns_usual_first_time():
    routines = _routines()
    kitchen = routines["kitchen"]
    assert kitchen.days_seen == 14
    assert kitchen.median_first == 8 * 60 + 5
    assert kitchen.today == TODAY and kitchen.today_first is None


def test_dict_round_trip_is_ints_only():
    r = _routines()["kitchen"]
    d = stub.routine_to_dict(r)
    assert d["last_event_ts"].endswith("Z")
    assert stub.routine_from_dict(d) == r


def test_late_start_fires_after_buffer_only():
    routines = _routines()
    early = stub.check_tick(routines, at(TODAY, "08:30"), CFG)
    assert "kitchen" not in {a.zone for a in early}  # 08:05 + 30 min buffer not yet passed
    late = stub.check_tick(routines, at(TODAY, "10:20"), CFG)
    kitchen = [a for a in late if a.zone == "kitchen"]
    assert kitchen and kitchen[0].kind == "late_start"
    assert kitchen[0].reason == "No kitchen movement by 10:20 (usually 08:05)"


def test_activity_today_prevents_late_start():
    routines = _routines()
    stub.update_on_event(routines["kitchen"], event("kitchen", at(TODAY, "08:00")))
    zones = {a.zone for a in stub.check_tick(routines, at(TODAY, "10:20"), CFG)}
    assert "kitchen" not in zones


def test_night_front_door_is_flagged_but_day_is_not():
    r = _routines()["front_door"]
    night = stub.check_event(r, event("front_door", at(TODAY, "02:10")), CFG)
    assert night is not None and night.kind == "night_activity"
    assert night.reason == "Front door opened at 02:10"
    assert stub.check_event(r, event("front_door", at(TODAY, "07:30")), CFG) is None


def test_long_inactivity_after_four_hours_of_silence():
    routines = _routines()
    for zone in ("bedroom", "kitchen", "front_door"):
        stub.update_on_event(routines[zone], event(zone, at(TODAY, "08:00")))
    assert not any(
        a.kind == "long_inactivity" for a in stub.check_tick(routines, at(TODAY, "11:30"), CFG)
    )
    idle = [a for a in stub.check_tick(routines, at(TODAY, "12:30"), CFG)]
    assert [a.kind for a in idle if a.zone is None] == ["long_inactivity"]
