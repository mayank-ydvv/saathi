"""Evening digest: facts computed in Python, worded by Bedrock, template fallback."""

from __future__ import annotations

import json
from datetime import date
from zoneinfo import ZoneInfo

from backend.digest import bedrock
from backend.engine.models import Event
from backend.engine.routine import ACTIVITY_TYPES, TIMEZONE

WAKING = (6 * 60, 22 * 60)
MEAL_GAP_MIN = 45  # kitchen events closer than this belong to one meal
OUTING_MIN = 15  # front door .. front door with nothing indoors in between, at least this long

SYSTEM = """You write a short evening update for an adult child about their elderly parent \
who lives alone. You receive FACTS as JSON from a home sensor system.
Rules:
- Warm, calm, reassuring, plain English. Address the child ("you"); call the parent by the \
name in the facts.
- 80 to 120 words, one paragraph, no lists, no headings, no emoji.
- Use ONLY the facts given. Never invent meals, visitors, moods, health details or reasons. \
If a fact is missing, do not mention it.
- Times are local 24h "HH:MM"; you may write them naturally (e.g. "around 7:05 am").
- If there were alerts, mention each honestly and how it was resolved.
- Only if something was unusual (alerts, or a quiet period over 3 hours), end with one gentle \
suggestion, such as a call. Otherwise end on a reassuring note."""


def compute_facts(
    home: dict, events: list[Event], alerts: list[dict], day: date, until: int = WAKING[1]
) -> dict:
    """Deterministic facts for one local day. One pass over the sorted events, O(n log n).

    The longest quiet stretch while awake runs from 06:00, through every event, to `until`
    (minute of the day the digest is written, at most 22:00), so a silent afternoon after
    the last event counts too (M1).
    """
    tz = ZoneInfo(TIMEZONE)
    first: dict[str, str] = {}
    meals: list[str] = []
    outings = dings = 0
    end = min(WAKING[1], until)
    longest_quiet = 0
    prev_awake = WAKING[0]
    last_kitchen = last_door = None
    indoor_since_door = False
    for e in sorted(events, key=lambda ev: ev.ts):
        t = e.ts.astimezone(tz)
        if t.date() != day or e.type not in ACTIVITY_TYPES:
            continue
        m = t.hour * 60 + t.minute
        first.setdefault(e.zone, _hhmm(m))
        dings += e.type == "ding"
        if WAKING[0] <= m <= end:
            longest_quiet = max(longest_quiet, m - prev_awake)
            prev_awake = m
        if e.zone == "kitchen" and WAKING[0] <= m < WAKING[1]:  # 02:00 isn't "breakfast" (L5)
            if last_kitchen is None or m - last_kitchen > MEAL_GAP_MIN:
                meals.append(f"{_meal(m)} around {_hhmm(m)}")
            last_kitchen = m
        if e.zone == "front_door":
            if last_door is not None and not indoor_since_door and m - last_door >= OUTING_MIN:
                outings += 1
            last_door, indoor_since_door = m, False
        else:
            indoor_since_door = True
    longest_quiet = max(longest_quiet, end - prev_awake, 0)
    return {
        "parent_name": home.get("parent_name") or "Your parent",
        "date": day.isoformat(),
        "any_activity": bool(first),
        "first_activity_by_zone": {z.replace("_", " "): t for z, t in first.items()},
        "kitchen_visits": meals,
        "outings": outings,
        "doorbell_rings": dings,
        "longest_quiet_minutes_while_awake": longest_quiet,
        "alerts": [_alert_fact(a) for a in alerts],
    }


def generate_digest(
    home: dict, events: list[Event], alerts: list[dict], day: date, until: int = WAKING[1]
) -> str:
    """80-120 word evening update. Bedrock words it from facts only; template if unavailable."""
    facts = compute_facts(home, events, alerts, day, until)
    text = bedrock.converse(SYSTEM, [{"text": "FACTS:\n" + json.dumps(facts)}], max_tokens=300)
    return text or fallback_digest(facts)


def fallback_digest(f: dict) -> str:
    """Template built from the same facts. Never says anything the facts don't."""
    name = f["parent_name"]
    if not f["any_activity"]:
        text = f"No movement was recorded for {name} today."
    else:
        starts = ", ".join(f"{z} at {t}" for z, t in f["first_activity_by_zone"].items())
        text = f"{name}'s day started with activity in the {starts}."
        if f["kitchen_visits"]:
            text += f" Kitchen: {'; '.join(f['kitchen_visits'])}."
        if f["outings"]:
            text += f" Went out {_times(f['outings'])}."
        if f["doorbell_rings"]:
            text += f" The doorbell rang {_times(f['doorbell_rings'])}."
        quiet = f["longest_quiet_minutes_while_awake"]
        if quiet >= 180:
            text += f" Longest quiet spell: {quiet // 60} h {quiet % 60} min."
    for a in f["alerts"]:
        text += f" Alert: {a['reason']}"
        text += f" — resolved by {a['resolved_by']}." if a["resolved_by"] else f" ({a['state']})."
    return text


def _alert_fact(a: dict) -> dict:
    acked = a.get("acked_by") or {}
    by = acked.get("name") or acked.get("by")
    return {"reason": a.get("reason", ""), "state": a.get("state", ""), "resolved_by": by}


def _meal(m: int) -> str:
    return "breakfast" if m < 11 * 60 else "lunch" if m < 16 * 60 else "dinner"


def _times(n: int) -> str:
    return "once" if n == 1 else "twice" if n == 2 else f"{n} times"


def _hhmm(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"
