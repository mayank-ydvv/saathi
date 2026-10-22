"""Phase 4: digest, visitor description and weekly trend with a mocked Bedrock (no network)."""

import json
from datetime import date, datetime, time
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from backend.digest import bedrock, describe_visitor, generate_digest, weekly_trend
from backend.digest.daily import compute_facts, fallback_digest
from backend.engine.backfill import read_jsonl
from backend.engine.models import Event
from backend.engine.routine import new_routine

FIXTURES = Path(__file__).parents[2] / "sandbox" / "fixtures"
DAY = date(2026, 10, 22)
HOME = {"home_id": "home-demo-1", "parent_name": "Ma", "city": "Delhi"}
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32


class FakeBedrock:
    def __init__(self, reply: str | None = None, error: Exception | None = None):
        self.reply, self.error, self.calls = reply, error, []

    def converse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return {"output": {"message": {"role": "assistant", "content": [{"text": self.reply}]}}}


@pytest.fixture
def fake(monkeypatch):
    def install(reply=None, error=None):
        f = FakeBedrock(reply, error)
        monkeypatch.setenv("BEDROCK_MODEL_ID", "test-model")
        monkeypatch.setattr(bedrock, "_client", f)
        return f

    return install


# digest -------------------------------------------------------------------------------
def test_facts_from_late_morning_fixture():
    f = compute_facts(HOME, read_jsonl(FIXTURES / "late_morning.jsonl"), [], DAY)
    assert f["parent_name"] == "Ma" and f["any_activity"]
    assert f["first_activity_by_zone"]["kitchen"] == "10:30"
    assert f["kitchen_visits"][0] == "breakfast around 10:30"
    assert [v.split()[0] for v in f["kitchen_visits"]] == ["breakfast", "lunch", "dinner"]
    assert f["doorbell_rings"] == 1


def test_facts_ignore_other_days_and_non_activity():
    events = read_jsonl(FIXTURES / "normal_14_days.jsonl")
    assert not compute_facts(HOME, events, [], DAY)["any_activity"]  # all before the 22nd


def test_fall_day_quiet_period_and_alert_facts():
    alert = {
        "reason": "No movement anywhere for 4 h 10 min (last: living room at 13:00)",
        "state": "RESOLVED",
        "acked_by": {"by": "family", "name": "Priya"},
    }
    f = compute_facts(HOME, read_jsonl(FIXTURES / "fall_day.jsonl"), [alert], DAY)
    assert f["alerts"] == [{"reason": alert["reason"], "state": "RESOLVED", "resolved_by": "Priya"}]


def test_outing_needs_door_twice_with_nothing_indoors_between():
    def ev(zone: str, hhmm: str) -> Event:  # IST hh:mm on DAY
        ts = datetime.combine(DAY, time.fromisoformat(hhmm), ZoneInfo("Asia/Kolkata"))
        return Event(f"{zone}-{hhmm}", "home-demo-1", "dev", zone, "motion", ts)

    out = [ev("front_door", "10:00"), ev("front_door", "11:00"), ev("kitchen", "11:05")]
    stayed = [ev("front_door", "12:00"), ev("kitchen", "12:05"), ev("front_door", "13:00")]
    stayed.append(ev("kitchen", "13:05"))
    quick = [ev("front_door", "14:00"), ev("front_door", "14:05")]  # under 15 min
    f = compute_facts(HOME, out + stayed + quick, [], DAY)
    assert f["outings"] == 1
    assert " Went out once." in fallback_digest(f)


def test_digest_sends_only_facts_to_bedrock(fake):
    f = fake("Ma had a calm, ordinary day.")
    events = read_jsonl(FIXTURES / "late_morning.jsonl")
    assert generate_digest(HOME, events, [], DAY) == "Ma had a calm, ordinary day."
    [call] = f.calls
    assert call["modelId"] == "test-model"
    assert "Never invent" in call["system"][0]["text"]
    [block] = call["messages"][0]["content"]
    sent = json.loads(block["text"].removeprefix("FACTS:\n"))
    assert sent == compute_facts(HOME, events, [], DAY)
    assert "event_id" not in block["text"] and "dev_" not in block["text"]  # no raw events


def test_digest_falls_back_on_error_and_without_model(fake, monkeypatch):
    events = read_jsonl(FIXTURES / "late_morning.jsonl")
    fake(error=RuntimeError("throttled"))
    text = generate_digest(HOME, events, [], DAY)
    assert text.startswith("Ma's day started") and "kitchen at 10:30" in text
    monkeypatch.delenv("BEDROCK_MODEL_ID")
    assert generate_digest(HOME, events, [], DAY) == text


def test_fallback_mentions_alert_and_no_activity(fake):
    fake(error=RuntimeError("down"))
    alert = {"reason": "No kitchen movement by 08:31 (usually 07:52)", "state": "ALERT_FAMILY"}
    text = generate_digest(HOME, [], [alert], DAY)
    assert text == (
        "No movement was recorded for Ma today. "
        "Alert: No kitchen movement by 08:31 (usually 07:52) (ALERT_FAMILY)."
    )


# visitor ------------------------------------------------------------------------------
def test_visitor_courier_no_caution(fake):
    fake(
        '{"summary": "A courier holding a box", "person_count": 1, '
        '"uniform_or_badge": true, "carrying_package": true}'
    )
    v = describe_visitor(JPEG)
    assert v == {
        "summary": "A courier holding a box",
        "person_count": 1,
        "uniform_or_badge": True,
        "carrying_package": True,
        "caution": False,
        "caution_reason": "",
    }


def test_visitor_unknown_caution_and_image_block(fake):
    f = fake(
        '```json\n{"summary": "One person at the door", "person_count": 1, '
        '"uniform_or_badge": false, "carrying_package": false}\n```'
    )
    v = describe_visitor(JPEG)
    assert v["caution"] is True and v["caution_reason"] == "No uniform, badge or package visible"
    image = f.calls[0]["messages"][0]["content"][0]["image"]
    assert image == {"format": "jpeg", "source": {"bytes": JPEG}}


@pytest.mark.parametrize(
    "reply",
    [
        "I see a person.",
        '{"summary": "", "person_count": 1, "uniform_or_badge": false, "carrying_package": false}',
        '{"summary": "x", "person_count": "1", "uniform_or_badge": false, "carrying_package": 0}',
        '{"summary": "x", "person_count": true, "uniform_or_badge": false, "carrying_package": 0}',
        '{"summary": "x", "person_count": 1, "uniform_or_badge": "no", "carrying_package": false}',
        "[1, 2]",
        '{"summary": x}',
    ],
)
def test_visitor_bad_json_safe_default(fake, reply):
    fake(reply)
    assert describe_visitor(JPEG)["summary"] == "Visitor at the door"
    assert describe_visitor(JPEG)["caution"] is False


def test_visitor_unknown_image_format_and_errors(fake):
    f = fake(error=TimeoutError())
    assert describe_visitor(b"not an image")["summary"] == "Visitor at the door"
    assert f.calls == []  # unknown format never reaches Bedrock
    assert describe_visitor(JPEG)["summary"] == "Visitor at the door"


# weekly trend -------------------------------------------------------------------------
def trend_routine(zone: str, prev: list[int], last: list[int]):
    r = new_routine("home-demo-1", zone)
    r.first_times = prev + last
    return r


def test_weekly_trend_later_and_earlier():
    assert (
        weekly_trend(trend_routine("bedroom", [420] * 7, [460] * 7))
        == "Waking about 40 minutes later this week"
    )
    assert (
        weekly_trend(trend_routine("kitchen", [480] * 7, [445] * 7))
        == "First kitchen activity about 35 minutes earlier this week"
    )


def test_weekly_trend_none_for_small_shift_or_short_history():
    assert weekly_trend(trend_routine("bedroom", [420] * 7, [445] * 7)) is None
    assert weekly_trend(trend_routine("bedroom", [420] * 4, [500] * 7)) is None
    assert weekly_trend(new_routine("home-demo-1", "bedroom")) is None


def test_weekly_trend_on_backfilled_fixture_is_stable():
    from backend.engine.backfill import build_routines

    for r in build_routines(read_jsonl(FIXTURES / "normal_14_days.jsonl")).values():
        assert weekly_trend(r) is None, r.zone
