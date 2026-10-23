"""Routine learning (Phase 1): accumulation, rollover, window eviction, serialization."""

import json
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from backend.engine.models import Event
from backend.engine.routine import (
    HISTORY_DAYS,
    new_routine,
    rollover_day,
    routine_from_dict,
    routine_to_dict,
    update_on_event,
)

IST = timedelta(hours=5, minutes=30)
DAY0 = date(2026, 10, 1)


def ev(day: date, hhmm: str, zone: str = "kitchen", type_: str = "motion.human") -> Event:
    """Event at local (Asia/Kolkata) `hhmm` on `day`, stored as UTC like the contract says."""
    h, m = map(int, hhmm.split(":"))
    local = datetime(day.year, day.month, day.day, h, m)
    ts = (local - IST).replace(tzinfo=UTC)
    return Event(f"evt_{day}_{hhmm}", "home-demo-1", "dev_kitchen_cam", zone, type_, ts)


def run(*events: Event):
    r = new_routine("home-demo-1", "kitchen")
    for e in events:
        update_on_event(r, e)
    return r


def test_one_day_accumulates_today_only():
    r = run(ev(DAY0, "08:05"), ev(DAY0, "08:10"), ev(DAY0, "13:00"))
    assert r.today == DAY0
    assert r.today_first == 8 * 60 + 5
    assert r.today_slots == {32, 52}  # 08:00-08:15 and 13:00-13:15
    assert sum(r.hist) == 0 and r.days_seen == 0  # hist only changes at rollover


def test_several_days_median_and_mad():
    firsts = ["08:00", "08:10", "07:50", "08:20", "08:00"]
    r = run(*(ev(DAY0 + timedelta(d), t) for d, t in enumerate(firsts)))
    rollover_day(r, DAY0 + timedelta(len(firsts)))
    assert r.days_seen == 5
    assert r.first_times == [480, 490, 470, 500, 480]
    assert r.median_first == 480
    assert r.mad_first == 10  # deviations 0,10,10,20,0 -> median 10
    assert (r.hist[31], r.hist[32], r.hist[33]) == (1, 3, 1)  # 07:50 | 08:00,08:10,08:00 | 08:20


def test_midnight_crossing_splits_days():
    r = run(ev(DAY0, "23:50"), ev(DAY0 + timedelta(1), "00:10"))
    assert r.today == DAY0 + timedelta(1)
    assert r.today_first == 10 and r.today_slots == {0}
    assert r.first_times == [23 * 60 + 50] and r.hist[95] == 1 and r.days_seen == 1


def test_duplicates_count_slot_once_per_day():
    e = ev(DAY0, "08:05")
    r = run(e, e, e, ev(DAY0, "08:14"))
    rollover_day(r, DAY0 + timedelta(1))
    assert r.hist[32] == 1


def test_out_of_order_within_day_and_late_previous_day():
    r = run(ev(DAY0, "09:00"), ev(DAY0, "07:30"))
    assert r.today_first == 450
    assert r.last_event_ts == ev(DAY0, "09:00").ts  # max, not latest delivered
    update_on_event(r, ev(DAY0 + timedelta(1), "08:00"))
    update_on_event(r, ev(DAY0, "22:00"))  # late event for the closed day: ignored
    assert r.hist[88] == 0 and r.today == DAY0 + timedelta(1)


def test_non_activity_types_ignored():
    r = run(ev(DAY0, "08:00", type_="package"), ev(DAY0, "09:00", type_="vehicle"))
    assert r.today is None and r.last_event_ts is None and not r.today_slots


def test_window_evicts_oldest_day_after_d_days():
    # day 0 is the only day active at 03:00; it must fall out after D more days
    events = [ev(DAY0, "03:00")] + [ev(DAY0 + timedelta(d), "08:00") for d in range(1, 16)]
    r = run(*events)
    rollover_day(r, DAY0 + timedelta(16))
    assert r.days_seen == HISTORY_DAYS == len(r.first_times) == len(r.day_slots)
    assert r.hist[12] == 0  # 03:00 slot evicted
    assert r.hist[32] == HISTORY_DAYS
    assert r.median_first == 480 and r.mad_first == 0


def test_quiet_day_rollover_and_scheduler_style_calls():
    r = new_routine("home-demo-1", "kitchen")
    rollover_day(r, DAY0)  # fresh routine: just starts the day
    assert r.today == DAY0 and r.days_seen == 0
    rollover_day(r, DAY0 + timedelta(1))  # quiet day adds nothing
    assert r.days_seen == 0 and sum(r.hist) == 0
    rollover_day(r, DAY0)  # going backwards is a no-op
    assert r.today == DAY0 + timedelta(1)


def test_serialization_round_trip_json_and_decimal():
    r = run(*(ev(DAY0 + timedelta(d), "08:0" + str(d)) for d in range(4)))
    d = routine_to_dict(r)
    assert json.loads(json.dumps(d)) == d
    assert not any(isinstance(v, float) for v in d.values())
    assert d["last_event_ts"].endswith("Z")
    assert routine_from_dict(json.loads(json.dumps(d))) == r
    # DynamoDB hands numbers back as Decimal
    dyn = {k: (Decimal(v) if isinstance(v, int) else v) for k, v in d.items()}
    dyn["hist"] = [Decimal(x) for x in d["hist"]]
    assert routine_from_dict(dyn) == r


def test_from_dict_accepts_records_without_day_slots():
    d = routine_to_dict(new_routine("home-demo-1", "kitchen"))
    del d["day_slots"]
    assert routine_from_dict(d).day_slots == []


def test_legacy_record_without_day_slots_stays_within_the_window():
    # A routine saved before day_slots existed: 14 days learned, no per-day slot lists.
    r = run(*(ev(DAY0 + timedelta(d), "08:05") for d in range(14)))
    rollover_day(r, DAY0 + timedelta(14))
    d = routine_to_dict(r)
    del d["day_slots"]
    legacy = routine_from_dict(d)
    for d in range(14, 17):
        update_on_event(legacy, ev(DAY0 + timedelta(d), "08:05"))
        rollover_day(legacy, DAY0 + timedelta(d + 1))
    assert legacy.days_seen == HISTORY_DAYS  # used to collapse to 3
    assert len(legacy.first_times) == HISTORY_DAYS  # used to grow to 17
    assert max(legacy.hist) <= legacy.days_seen  # a slot can't be active on more days than seen
    assert legacy.median_first == 8 * 60 + 5
