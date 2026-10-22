from datetime import date, timedelta

import pytest

from backend.api.scheduler import Scheduler
from backend.common import engine
from backend.escalation.base import ImmediateEscalator
from tests.backend.factories import HOME, at, event, normal_days

TODAY = date(2026, 10, 22)


class RecordingEscalator(ImmediateEscalator):
    def __init__(self, store):
        super().__init__(store)
        self.started: list[str] = []

    def start(self, alert):
        self.started.append(alert["alert_id"])


@pytest.fixture
def learned(store):
    """14 normal days learned; routines still on yesterday (as at 23:59)."""
    store.put_home({"home_id": HOME, "parent_name": "Kamala", "city": "Chennai", "devices": {}})
    for r in engine.build_routines(normal_days(TODAY - timedelta(days=14))).values():
        store.put_routine(engine.routine_to_dict(r))
    return store


@pytest.fixture
def sched(learned, settings):
    digests = []
    s = Scheduler(
        learned, settings, RecordingEscalator(learned), on_digest=lambda h, d: digests.append(d)
    )
    s.digests = digests
    return s


def test_midnight_rollover_closes_yesterday(sched, learned):
    result = sched.tick(at(TODAY, "00:01"))
    assert result.rolled_over == 4
    kitchen = engine.routine_from_dict(learned.get_routine(HOME, "kitchen"))
    assert kitchen.today == TODAY and kitchen.days_seen == 14 and kitchen.today_first is None
    assert sched.tick(at(TODAY, "00:02")).rolled_over == 0


def test_late_start_opens_one_alert_and_starts_escalation(sched, learned):
    assert sched.tick(at(TODAY, "06:00")).alerts == []  # before any usual first activity
    result = sched.tick(at(TODAY, "10:20"))
    assert len(result.alerts) == 1
    alert = result.alerts[0]
    assert alert["kind"] == "late_start" and alert["state"] == "SUSPECT"
    assert sched.escalator.started == [alert["alert_id"]]
    assert sched.tick(at(TODAY, "10:21")).alerts == []  # one open alert per home
    assert len(learned.list_alerts(HOME)) == 1


def test_normal_morning_raises_nothing(sched, learned):
    sched.tick(at(TODAY, "00:01"))
    for zone, hhmm in [("bedroom", "06:45"), ("front_door", "07:30"), ("kitchen", "08:05")]:
        r = engine.routine_from_dict(learned.get_routine(HOME, zone))
        learned.put_routine(
            engine.routine_to_dict(engine.update_on_event(r, event(zone, at(TODAY, hhmm))))
        )
    assert sched.tick(at(TODAY, "10:20")).alerts == []


def test_digest_once_after_digest_time(sched, learned):
    learned.put_event_if_new(
        {
            "event_id": "evt_1",
            "home_id": HOME,
            "device_id": "d",
            "zone": "kitchen",
            "type": "motion.human",
            "ts": "2026-10-22T02:35:00Z",
            "snapshot_key": None,
        }
    )
    assert sched.tick(at(TODAY, "20:59")).digests == []
    (digest,) = sched.tick(at(TODAY, "21:00")).digests
    assert digest["date"] == "2026-10-22" and "Kamala" in digest["text"]
    assert learned.get_digest(HOME, TODAY) == digest
    assert sched.digests == [digest]
    assert sched.tick(at(TODAY, "21:01")).digests == []


def test_digest_falls_back_to_template_when_generator_fails(sched, learned, monkeypatch):
    def broken(*args, **kwargs):
        raise RuntimeError("Bedrock throttled")

    monkeypatch.setattr(engine, "generate_digest", broken)
    (digest,) = sched.tick(at(TODAY, "21:30")).digests
    assert digest["text"] == "Kamala: 0 events recorded today."


def test_digest_not_resent_after_restart(sched, learned, settings):
    sched.tick(at(TODAY, "21:00"))
    fresh = Scheduler(learned, settings, ImmediateEscalator(learned))
    assert fresh.tick(at(TODAY, "21:05")).digests == []
