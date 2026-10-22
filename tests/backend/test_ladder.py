"""Escalation ladder with tiny waits: transitions, side effects, acks at every step."""

import asyncio

import pytest

from backend.common import clock
from backend.engine.models import Anomaly
from backend.escalation.alerts import open_alert
from backend.escalation.ladder import LadderCore, LocalLadder
from tests.backend.factories import HOME

TINY = {"SUSPECT": 0.05, "NUDGE_PARENT": 0.05, "ALERT_FAMILY": 0.05}
LADDER = ["SUSPECT", "NUDGE_PARENT", "ALERT_FAMILY", "ALERT_NEIGHBOUR"]


class FakeNotifier:
    def __init__(self):
        self.sent = []

    def alert(self, alert, home, audience, last_seen):
        self.sent.append(("alert", audience, alert["state"]))

    def resolved(self, alert, home):
        self.sent.append(("resolved", alert["acked_by"]["by"], alert["state"]))

    def digest(self, home, record):
        self.sent.append(("digest", record["date"], None))


class FakeVoice:
    def __init__(self):
        self.texts = []

    def audio_url(self, text):
        self.texts.append(text)
        return "http://localhost:8000/blobs/audio/x.mp3"


@pytest.fixture
def parts(store):
    store.put_home({"home_id": HOME, "parent_name": "Kamala", "city": "Chennai", "devices": {}})
    notifier, voice = FakeNotifier(), FakeVoice()
    return store, notifier, voice, LadderCore(store, notifier, voice)


def _alert(store):
    now = clock.now()
    anomaly = Anomaly(HOME, "late_start", "kitchen", "No kitchen movement by 10:20", now, {})
    return open_alert(store, anomaly, now)


async def _wait_for(store, alert_id, state, timeout=2.0):
    deadline = asyncio.get_running_loop().time() + timeout
    while asyncio.get_running_loop().time() < deadline:
        if store.find_alert(alert_id)["state"] == state:
            return
        await asyncio.sleep(0.01)
    raise AssertionError(f"{alert_id} never reached {state}: {store.find_alert(alert_id)['state']}")


async def test_full_ladder_reaches_neighbour_with_side_effects(parts):
    store, notifier, voice, core = parts
    ladder = LocalLadder(core, TINY)
    ladder.bind(asyncio.get_running_loop())
    alert = _alert(store)
    ladder.start(alert)
    await _wait_for(store, alert["alert_id"], "ALERT_NEIGHBOUR")
    stored = store.find_alert(alert["alert_id"])
    assert [s["state"] for s in stored["steps"]] == LADDER
    assert notifier.sent == [
        ("alert", "family", "ALERT_FAMILY"),
        ("alert", "neighbour", "ALERT_NEIGHBOUR"),
    ]
    assert voice.texts and "Kamala, are you okay?" in voice.texts[0]
    await asyncio.sleep(0.15)  # nothing after the last step
    assert store.find_alert(alert["alert_id"])["state"] == "ALERT_NEIGHBOUR"


@pytest.mark.parametrize("ack_in", LADDER)
async def test_ack_at_each_step_resolves_and_stops(parts, ack_in):
    store, notifier, _, core = parts
    ladder = LocalLadder(core, TINY)
    ladder.bind(asyncio.get_running_loop())
    alert = _alert(store)
    ladder.start(alert)
    await _wait_for(store, alert["alert_id"], ack_in)
    result = await asyncio.to_thread(ladder.ack, alert["alert_id"], "parent", "Kamala")
    assert result["state"] == "RESOLVED"
    await asyncio.sleep(0.25)  # longer than every remaining wait
    stored = store.find_alert(alert["alert_id"])
    assert stored["state"] == "RESOLVED"
    assert [s["state"] for s in stored["steps"]] == LADDER[: LADDER.index(ack_in) + 1] + [
        "RESOLVED"
    ]
    assert stored["acked_by"] == {"by": "parent", "name": "Kamala"}
    assert notifier.sent[-1] == ("resolved", "parent", "RESOLVED")


async def test_double_ack_is_idempotent(parts):
    store, notifier, _, core = parts
    ladder = LocalLadder(core, TINY)
    ladder.bind(asyncio.get_running_loop())
    alert = _alert(store)
    ladder.start(alert)
    first = ladder.ack(alert["alert_id"], "family", "Priya")
    second = ladder.ack(alert["alert_id"], "neighbour", "Ravi")
    assert first["acked_by"] == second["acked_by"] == {"by": "family", "name": "Priya"}
    assert [s for s in notifier.sent if s[0] == "resolved"] == [("resolved", "family", "RESOLVED")]
    assert ladder.ack("alt_missing", "family", "Priya") is None


def test_enter_after_resolve_is_a_no_op(parts):
    store, notifier, _, core = parts
    alert = _alert(store)
    core.resolve(alert["alert_id"], "parent", "Kamala")
    assert core.enter(alert["alert_id"], "ALERT_FAMILY") is None
    assert store.find_alert(alert["alert_id"])["state"] == "RESOLVED"
    assert [s[0] for s in notifier.sent] == ["resolved"]


def test_reentering_a_state_does_not_notify_twice(parts):
    store, notifier, _, core = parts
    alert = _alert(store)
    core.enter(alert["alert_id"], "ALERT_FAMILY")
    core.enter(alert["alert_id"], "ALERT_FAMILY", extra={"task_token": "t2"})
    assert notifier.sent == [("alert", "family", "ALERT_FAMILY")]
    assert store.find_alert(alert["alert_id"])["task_token"] == "t2"


async def test_resume_rearms_open_alert_after_restart(parts):
    store, _, _, core = parts
    alert = _alert(store)  # created by a previous process, never escalated
    ladder = LocalLadder(core, TINY)
    ladder.bind(asyncio.get_running_loop())
    assert ladder.resume([HOME]) == 1
    await _wait_for(store, alert["alert_id"], "NUDGE_PARENT")


def test_unbound_ladder_leaves_alert_in_suspect(parts):
    store, _, _, core = parts
    alert = _alert(store)
    LocalLadder(core, TINY).start(alert)
    assert store.find_alert(alert["alert_id"])["state"] == "SUSPECT"
