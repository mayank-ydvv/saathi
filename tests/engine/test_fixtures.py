"""Phase 3: the generated fixtures replayed through the engine like ingest + scheduler would."""

import json
from datetime import timedelta
from pathlib import Path

from backend.engine.anomaly import check_event, check_tick
from backend.engine.backfill import build_routines, main, read_jsonl
from backend.engine.models import EngineConfig, Event, Routine
from backend.engine.routine import new_routine, rollover_day, routine_from_dict, update_on_event

FIXTURES = Path(__file__).parents[2] / "sandbox" / "fixtures"
IST = timedelta(hours=5, minutes=30)
CFG = EngineConfig()


def replay(routines: dict[str, Routine], events: list[Event]) -> list[tuple[str, str | None]]:
    """Feed events in order and tick every minute over their whole local days. Returns anomalies."""
    events = sorted(events, key=lambda e: e.ts)
    first_day = (events[0].ts + IST).date()
    last_day = (events[-1].ts + IST).date()
    start = (events[0].ts + IST).replace(hour=0, minute=0, second=0) - IST
    minutes = ((last_day - first_day).days + 1) * 1440
    out, i = [], 0
    for m in range(1, minutes + 1):
        now = start + timedelta(minutes=m)
        while i < len(events) and events[i].ts <= now:
            e = events[i]
            r = routines.get(e.zone) or routines.setdefault(e.zone, new_routine(e.home_id, e.zone))
            if a := check_event(r, e, CFG):
                out.append((a.kind, a.zone))
            update_on_event(r, e)
            i += 1
        today = (now + IST).date()
        for r in routines.values():  # the scheduler's quiet-midnight rollover
            if r.today is None or r.today < today:
                rollover_day(r, today)
        out += [(a.kind, a.zone) for a in check_tick(routines, now, CFG)]
    return out


def backfilled() -> dict[str, Routine]:
    return build_routines(read_jsonl(FIXTURES / "normal_14_days.jsonl"))


def test_normal_14_days_from_scratch_no_anomalies():
    assert replay({}, read_jsonl(FIXTURES / "normal_14_days.jsonl")) == []


def test_backfill_learns_every_zone():
    routines = backfilled()
    assert sorted(routines) == ["bedroom", "front_door", "kitchen", "living_room"]
    for r in routines.values():
        assert r.days_seen == 13 and r.today is not None  # last day stays open, like live ingest


def test_fall_day_long_inactivity_once():
    assert replay(backfilled(), read_jsonl(FIXTURES / "fall_day.jsonl")) == [
        ("long_inactivity", None)
    ]


def test_late_morning_late_start_once():
    assert replay(backfilled(), read_jsonl(FIXTURES / "late_morning.jsonl")) == [
        ("late_start", "kitchen")
    ]


def test_night_door_night_activity_once():
    assert replay(backfilled(), read_jsonl(FIXTURES / "night_door.jsonl")) == [
        ("night_activity", "front_door")
    ]


def test_cli_matches_committed_routines_file(tmp_path):
    out = tmp_path / "routines.json"
    main(["--input", str(FIXTURES / "normal_14_days.jsonl"), "--output", str(out)])
    written = json.loads(out.read_text(encoding="utf-8"))
    committed = json.loads((FIXTURES / "routines_home-demo-1.json").read_text(encoding="utf-8"))
    assert written == committed
    assert {z: routine_from_dict(d) for z, d in written.items()} == backfilled()


def test_generator_is_deterministic(tmp_path):
    import importlib.util

    spec = importlib.util.spec_from_file_location("generate", FIXTURES / "generate.py")
    gen = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gen)
    gen.main(tmp_path)
    for name in ("normal_14_days", "fall_day", "late_morning", "night_door"):
        fresh = (tmp_path / f"{name}.jsonl").read_text(encoding="utf-8")
        assert fresh == (FIXTURES / f"{name}.jsonl").read_text(encoding="utf-8"), name


def test_fixture_events_match_contract():
    for path in FIXTURES.glob("*.jsonl"):
        for line in path.read_text(encoding="utf-8").splitlines():
            d = json.loads(line)
            assert set(d) == {
                "event_id",
                "home_id",
                "device_id",
                "zone",
                "type",
                "ts",
                "snapshot_key",
            }
            assert d["ts"].endswith("Z") and d["home_id"] == "home-demo-1"
