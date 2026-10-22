"""Telegram client/notifier/updates, SNS, and the Step Functions runtime (all faked I/O)."""

import json

import httpx
import pytest
from botocore.exceptions import ClientError
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.escalation.ladder import LadderCore
from backend.escalation.notifier import CompositeNotifier, SnsNotifier, TelegramNotifier
from backend.escalation.stepfunctions import StepFunctionsEscalator, run_step
from backend.escalation.telegram import (
    TelegramClient,
    TelegramPoller,
    ack_data,
    handle_update,
    parse_ack_data,
    webhook_router,
)
from tests.backend.factories import HOME
from tests.backend.test_ladder import FakeNotifier, _alert

HOME_DOC = {
    "home_id": HOME,
    "parent_name": "Kamala",
    "city": "Chennai",
    "devices": {},
    "contacts": {"family": {"name": "Priya", "telegram_chat_id": "111"}, "neighbour": {}},
}


class FakeTelegram:
    """Records Bot API calls made through httpx."""

    def __init__(self, updates=None):
        self.calls = []
        self.updates = updates or []

    def handler(self, request: httpx.Request) -> httpx.Response:
        method = request.url.path.rsplit("/", 1)[-1]
        body = json.loads(request.content or b"{}")
        self.calls.append((method, body))
        if method == "getUpdates":
            result, self.updates = self.updates, []
            return httpx.Response(200, json={"ok": True, "result": result})
        return httpx.Response(200, json={"ok": True, "result": {"message_id": 1}})

    def client(self):
        return TelegramClient(
            "123:ABC", http=httpx.Client(transport=httpx.MockTransport(self.handler))
        )


def _press(alert_id, audience="family", first_name="Priya", update_id=7):
    return {
        "update_id": update_id,
        "callback_query": {
            "id": "cbq1",
            "from": {"id": 42, "first_name": first_name},
            "data": ack_data(alert_id, audience),
        },
    }


def test_ack_data_round_trip_and_limits():
    data = ack_data("alt_01a2b3c4d5e6f7a8", "neighbour")
    assert parse_ack_data(data) == ("alt_01a2b3c4d5e6f7a8", "neighbour")
    assert len(data.encode()) <= 64
    assert parse_ack_data("ack:x:stranger") is None and parse_ack_data(None) is None


def test_telegram_notifier_sends_button_to_contact_chat(settings, store):
    fake = FakeTelegram()
    store.put_home(HOME_DOC)
    alert = _alert(store)
    seen = {"zone": "bedroom", "ts": "2026-10-22T01:15:00Z"}
    TelegramNotifier(fake.client(), settings).alert(
        {**alert, "state": "ALERT_FAMILY"}, HOME_DOC, "family", seen
    )
    ((method, body),) = fake.calls
    assert method == "sendMessage" and body["chat_id"] == "111"
    assert "No kitchen movement by 10:20" in body["text"]
    assert "Last seen: bedroom at 06:45" in body["text"]
    assert "Family alert" in body["text"]
    button = body["reply_markup"]["inline_keyboard"][0][0]
    assert button == {
        "text": "I'm checking",
        "callback_data": ack_data(alert["alert_id"], "family"),
    }


def test_missing_chat_id_is_skipped_not_raised(settings):
    fake = FakeTelegram()
    TelegramNotifier(fake.client(), settings).alert(
        {"alert_id": "a", "state": "ALERT_NEIGHBOUR", "reason": "r"}, HOME_DOC, "neighbour", None
    )
    assert fake.calls == []


def test_button_press_acks_with_telegram_name(store):
    fake = FakeTelegram()
    acked = []
    assert handle_update(
        _press("alt_1"), lambda a, b, n: acked.append((a, b, n)) or {"x": 1}, fake.client()
    )
    assert acked == [("alt_1", "family", "Priya")]
    assert fake.calls[-1][0] == "answerCallbackQuery"
    assert (
        handle_update({"update_id": 1, "message": {"text": "hi"}}, lambda *a: None, None) is False
    )


def test_poller_advances_offset(store):
    fake = FakeTelegram(updates=[_press("alt_1", update_id=10), _press("alt_2", update_id=11)])
    acked = []
    poller = TelegramPoller(fake.client(), lambda a, b, n: acked.append(a))
    assert poller.poll_once() == 2 and acked == ["alt_1", "alt_2"]
    poller.poll_once()
    get_updates = [body for method, body in fake.calls if method == "getUpdates"]
    assert get_updates[-1]["offset"] == 12
    assert get_updates[0]["allowed_updates"] == ["callback_query"]


def test_telegram_webhook_route_checks_secret():
    acked = []

    class Esc:
        def ack(self, alert_id, by, name):
            acked.append((alert_id, by, name))
            return {"alert_id": alert_id}

    app = FastAPI()
    app.include_router(webhook_router("s3cret", lambda: None))
    app.state.escalator = Esc()
    client = TestClient(app)
    assert client.post("/telegram/webhook", json=_press("alt_9")).status_code == 401
    ok = client.post(
        "/telegram/webhook",
        json=_press("alt_9", "neighbour", "Ravi"),
        headers={"X-Telegram-Bot-Api-Secret-Token": "s3cret"},
    )
    assert ok.json() == {"ok": True} and acked == [("alt_9", "neighbour", "Ravi")]


def test_sns_and_composite_isolate_failures():
    published = []

    class Sns:
        def publish(self, **kwargs):
            published.append(kwargs)

    class Broken:
        def alert(self, *args):
            raise RuntimeError("down")

    alert = {"alert_id": "a", "state": "ALERT_FAMILY", "reason": "No kitchen movement"}
    CompositeNotifier([Broken(), SnsNotifier("arn:aws:sns:us-east-1:1:t", client=Sns())]).alert(
        alert, HOME_DOC, "family", None
    )
    assert published[0]["TopicArn"] == "arn:aws:sns:us-east-1:1:t"
    assert "No kitchen movement" in published[0]["Message"]


class FakeSfn:
    def __init__(self, fail_success=False):
        self.calls = []
        self.fail_success = fail_success

    def start_execution(self, **kwargs):
        self.calls.append(("start_execution", kwargs))

    def send_task_success(self, **kwargs):
        self.calls.append(("send_task_success", kwargs))
        if self.fail_success:
            raise ClientError({"Error": {"Code": "TaskTimedOut"}}, "SendTaskSuccess")


@pytest.fixture
def core(store):
    store.put_home(HOME_DOC)
    return LadderCore(store, FakeNotifier())


def test_step_functions_start_passes_waits(core, store):
    sfn = FakeSfn()
    waits = {"SUSPECT": 10, "NUDGE_PARENT": 15, "ALERT_FAMILY": 20}
    alert = _alert(store)
    StepFunctionsEscalator(core, "arn:sm", waits, client=sfn).start(alert)
    ((name, kwargs),) = sfn.calls
    assert name == "start_execution" and kwargs["name"] == alert["alert_id"]
    assert json.loads(kwargs["input"])["waits"] == {"suspect": 10, "nudge": 15, "family": 20}


def test_step_lambda_stores_token_and_ack_sends_success(core, store):
    sfn = FakeSfn()
    alert = _alert(store)
    out = run_step(
        core, {"alert_id": alert["alert_id"], "state": "NUDGE_PARENT", "task_token": "tok1"}, sfn
    )
    assert out == {"alert_id": alert["alert_id"], "state": "NUDGE_PARENT"}
    assert store.find_alert(alert["alert_id"])["task_token"] == "tok1"

    esc = StepFunctionsEscalator(core, "arn:sm", {}, client=sfn)
    assert esc.ack(alert["alert_id"], "parent", "Kamala")["state"] == "RESOLVED"
    assert sfn.calls[-1][0] == "send_task_success" and sfn.calls[-1][1]["taskToken"] == "tok1"


def test_step_after_resolve_finishes_execution(core, store):
    sfn = FakeSfn(fail_success=False)
    alert = _alert(store)
    core.resolve(alert["alert_id"], "family", "Priya")
    out = run_step(
        core, {"alert_id": alert["alert_id"], "state": "ALERT_FAMILY", "task_token": "t"}, sfn
    )
    assert out["resolved"] is True and sfn.calls[0][0] == "send_task_success"


def test_expired_token_on_ack_is_ignored(core, store):
    sfn = FakeSfn(fail_success=True)
    alert = _alert(store)
    run_step(core, {"alert_id": alert["alert_id"], "state": "SUSPECT", "task_token": "old"}, sfn)
    assert StepFunctionsEscalator(core, "arn", {}, client=sfn).ack(alert["alert_id"], "family", "P")
