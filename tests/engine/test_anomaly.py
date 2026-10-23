"""Anomaly detection (Phase 2) with a fixed clock: late start, long inactivity, night activity."""

from datetime import UTC, date, datetime, timedelta

from backend.engine.anomaly import check_event, check_tick
from backend.engine.models import EngineConfig, Event, Routine
from backend.engine.routine import (
    new_routine,
    rollover_day,
    routine_from_dict,
    routine_to_dict,
    update_on_event,
)

IST = timedelta(hours=5, minutes=30)
TODAY = date(2026, 10, 22)
CFG = EngineConfig()


def at(hhmm: str, day: date = TODAY) -> datetime:
    """UTC instant for local (Asia/Kolkata) `hhmm` on `day`."""
    h, m = map(int, hhmm.split(":"))
    return (datetime(day.year, day.month, day.day, h, m) - IST).replace(tzinfo=UTC)


def ev(zone: str, hhmm: str, day: date = TODAY, type_: str = "motion.human") -> Event:
    return Event(
        f"evt_{zone}_{day}_{hhmm}", "home-demo-1", f"dev_{zone}", zone, type_, at(hhmm, day)
    )


def learned(
    zone: str, first: str = "08:00", days: int = 14, extra: tuple[str, ...] = ()
) -> Routine:
    """Routine with `days` normal days (first activity `first`, plus `extra` times) before TODAY."""
    r = new_routine("home-demo-1", zone)
    for d in range(days, 0, -1):
        day = TODAY - timedelta(days=d)
        for t in (first, "13:00", "21:00", *extra):
            update_on_event(r, ev(zone, t, day))
    rollover_day(r, TODAY)
    return r


def kinds(anomalies) -> list[tuple[str, str | None]]:
    return [(a.kind, a.zone) for a in anomalies]


def only(anomalies, kind: str) -> list:
    return [a for a in anomalies if a.kind == kind]


# late_start ----------------------------------------------------------------------------
def test_on_time_morning_no_alert():
    r = learned("kitchen")
    update_on_event(r, ev("kitchen", "08:05"))
    assert check_tick({"kitchen": r}, at("11:00"), CFG) == []


def test_late_morning_alerts_once_after_threshold():
    r = learned("kitchen")  # median 08:00, MAD 0 -> threshold 08:30
    routines = {"kitchen": r}
    assert check_tick(routines, at("08:30"), CFG) == []
    [a] = only(check_tick(routines, at("10:15"), CFG), "late_start")
    assert a.zone == "kitchen"
    assert a.reason == "No kitchen movement by 10:15 (usually 08:00)"
    assert check_tick(routines, at("10:16"), CFG) == []  # no spam on later ticks
    # the marker survives a save/load (the scheduler persists routines between ticks)
    reloaded = {"kitchen": routine_from_dict(routine_to_dict(r))}
    assert check_tick(reloaded, at("10:30"), CFG) == []


def test_late_start_buffer_uses_mad():
    r = learned("kitchen")
    r.median_first, r.mad_first = 480, 20  # threshold 08:00 + 60 min
    assert check_tick({"kitchen": r}, at("08:59"), CFG) == []
    assert kinds(check_tick({"kitchen": r}, at("09:01"), CFG)) == [("late_start", "kitchen")]


def test_stale_today_counts_as_no_activity_today():
    r = learned("kitchen")
    r.today, r.today_first = TODAY - timedelta(days=1), 480  # scheduler hasn't rolled over yet
    assert kinds(check_tick({"kitchen": r}, at("09:00"), CFG)) == [("late_start", "kitchen")]


def test_cold_start_only_kitchen_against_default():
    kitchen, bedroom = new_routine("home-demo-1", "kitchen"), new_routine("home-demo-1", "bedroom")
    routines = {"kitchen": kitchen, "bedroom": bedroom}
    assert check_tick(routines, at("08:30"), CFG) == []
    assert kinds(check_tick(routines, at("08:31"), CFG)) == [("late_start", "kitchen")]


def test_alert_fires_again_next_day():
    r = learned("kitchen")
    assert len(check_tick({"kitchen": r}, at("10:00"), CFG)) == 1
    rollover_day(r, TODAY + timedelta(days=1))
    later = at("10:00", TODAY + timedelta(days=1))
    assert kinds(check_tick({"kitchen": r}, later, CFG)) == [("late_start", "kitchen")]


# long_inactivity -----------------------------------------------------------------------
def test_inactivity_during_day_alerts_once():
    r = learned("living_room", first="07:00")
    update_on_event(r, ev("living_room", "07:00"))
    update_on_event(r, ev("living_room", "13:05"))
    routines = {"living_room": r}
    assert check_tick(routines, at("17:05"), CFG) == []  # exactly 4 h: not yet
    [a] = check_tick(routines, at("17:15"), CFG)
    assert a.kind == "long_inactivity" and a.zone is None
    assert a.reason == "No movement anywhere for 4 h 10 min (last: living room at 13:05)"
    assert check_tick(routines, at("18:00"), CFG) == []


def test_inactivity_uses_latest_zone_across_home():
    kitchen, living = learned("kitchen"), learned("living_room", first="07:00")
    update_on_event(kitchen, ev("kitchen", "08:00"))
    update_on_event(living, ev("living_room", "12:00"))
    routines = {"kitchen": kitchen, "living_room": living}
    assert check_tick(routines, at("15:00"), CFG) == []  # living room 3 h ago


def test_no_inactivity_alert_at_night():
    r = learned("living_room", first="07:00")
    update_on_event(r, ev("living_room", "07:00"))
    update_on_event(r, ev("living_room", "17:00"))
    assert check_tick({"living_room": r}, at("23:30"), CFG) == []


def test_normal_night_sleep_does_not_count_as_inactivity():
    r = learned("bedroom", first="06:45")  # last event yesterday 21:00
    assert check_tick({"bedroom": r}, at("06:30"), CFG) == []
    # 06:00 + 4 h not reached (late_start for the bedroom is expected by now)
    assert only(check_tick({"bedroom": r}, at("09:59"), CFG), "long_inactivity") == []
    [a] = only(check_tick({"bedroom": r}, at("10:10"), CFG), "long_inactivity")
    assert a.reason.endswith("(last: bedroom at 21:00 yesterday)")


# night_activity ------------------------------------------------------------------------
def test_rare_front_door_at_2am_alerts_once():
    r = learned("front_door", first="06:30")
    a = check_event(r, ev("front_door", "02:10"), CFG)
    assert a is not None and a.kind == "night_activity" and a.zone == "front_door"
    assert a.reason == "Front door opened at 02:10 — unusual for this hour"
    assert check_event(r, ev("front_door", "02:12"), CFG) is None  # same night: no spam


def test_night_alert_repeats_after_30_min_at_most_3_per_night():
    r = learned("front_door", first="06:30")
    fired = [
        t
        for t in ("23:30", "23:40", "00:10", "02:10", "02:30", "03:00", "04:00")
        if check_event(r, ev("front_door", t, TODAY if t >= "12" else TODAY + timedelta(1)), CFG)
    ]
    # 23:40 is 10 min after the first; 02:30 is 20 min after 02:10; 03:00 would be the 4th
    assert fired == ["23:30", "00:10", "02:10"]
    next_night = ev("front_door", "02:10", TODAY + timedelta(days=2))
    assert check_event(r, next_night, CFG) is not None  # a new night starts over


def test_night_repeat_is_configurable_and_survives_round_trip():
    cfg = EngineConfig(night_repeat_minutes=60, night_max_per_night=2)
    r = learned("front_door", first="06:30")
    assert check_event(r, ev("front_door", "01:00"), cfg) is not None
    r = routine_from_dict(routine_to_dict(r))
    assert check_event(r, ev("front_door", "01:40"), cfg) is None  # < 60 min
    assert check_event(r, ev("front_door", "02:05"), cfg) is not None
    assert check_event(r, ev("front_door", "04:00"), cfg) is None  # max 2


def test_frequent_night_slot_no_alert():
    r = learned("kitchen", extra=("23:00",))  # a nightly 23:00 snack
    assert check_event(r, ev("kitchen", "23:05"), CFG) is None


def test_night_activity_ignored_in_waking_hours_other_zones_and_cold_start():
    assert check_event(learned("front_door"), ev("front_door", "10:00"), CFG) is None
    assert check_event(learned("bedroom"), ev("bedroom", "02:10"), CFG) is None
    young = learned("front_door", days=4)
    assert check_event(young, ev("front_door", "02:10"), CFG) is None
    pkg = ev("front_door", "02:10", type_="package")
    assert check_event(learned("front_door"), pkg, CFG) is None


def test_kitchen_night_reason():
    a = check_event(learned("kitchen"), ev("kitchen", "03:00"), CFG)
    assert a is not None and a.reason == "Kitchen movement at 03:00 — unusual for this hour"


def test_late_start_only_for_day_start_zones():
    # A late front door or living room is normal (no milk today, reading in bed); only the
    # kitchen and bedroom say whether the day started.
    door, living = learned("front_door", first="06:30"), learned("living_room", first="08:30")
    assert (
        only(
            check_tick({"front_door": door, "living_room": living}, at("12:00"), CFG), "late_start"
        )
        == []
    )
    bedroom = learned("bedroom", first="07:00")
    assert kinds(only(check_tick({"bedroom": bedroom}, at("08:00"), CFG), "late_start")) == [
        ("late_start", "bedroom")
    ]
