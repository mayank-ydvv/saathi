# Saathi prompts (Amazon Bedrock, Converse API)

Both features follow one rule: **Python decides what is true, the model only words it.**
Every call has a 20 s timeout, one retry, and a deterministic fallback, so the app never
breaks when Bedrock is slow, throttled or not configured (`BEDROCK_MODEL_ID` unset).

## 1. Evening digest — `daily.py`

**Input to the model:** only a compact JSON of facts computed in one pass over the day's
events — never raw events, device ids or timestamps:

```json
{"parent_name": "Ma", "date": "2026-10-22", "any_activity": true,
 "first_activity_by_zone": {"front door": "06:22", "bedroom": "06:48",
                            "living room": "08:36", "kitchen": "10:30"},
 "kitchen_visits": ["breakfast around 10:30", "lunch around 12:45", "dinner around 19:51"],
 "outings": 0, "doorbell_rings": 1, "longest_quiet_minutes_while_awake": 97,
 "alerts": [{"reason": "No kitchen movement by 08:31 (usually 07:52)", "state": "RESOLVED",
             "resolved_by": "Ma"}]}
```

**System prompt:** see `SYSTEM` in `daily.py`. Design choices:

| Rule | Why |
|---|---|
| Warm, calm, addressed to the child, parent by name | The reader is a worried son/daughter in another city; tone matters as much as content. |
| 80–120 words, one paragraph, no lists/emoji | Fits a Telegram message and the dashboard card; reads like a note, not a report. |
| Use ONLY the facts, never invent meals, visitors, moods, health | The model sees no raw data, and is told not to fill gaps. A digest that invents "she seemed happy" destroys trust. |
| Mention every alert honestly, with how it was resolved | Reassurance must not hide that something happened. |
| One gentle suggestion only when something was unusual | Avoids nagging on normal days; nudges a call when it matters. |
| `temperature` 0.2 | Consistent wording, little creative drift. |

**Fallback:** a template sentence from the same facts (`fallback_digest`).

## 2. Doorbell visitor — `visitor.py`

**Input:** the snapshot as a Converse `image` block plus one line of text.

**System prompt:** see `SYSTEM` in `visitor.py`. The model returns only visible facts:
`summary`, `person_count`, `uniform_or_badge`, `carrying_package`.

| Rule | Why |
|---|---|
| No identity, name, age, gender, religion, ethnicity or intent; no face recognition | Privacy and fairness: a safety feature must not profile people at the door. |
| Visible facts only, "if unsure use false/0" | Uncertainty degrades to the safe default, not to a guess. |
| JSON only, exact keys | Parsed and validated strictly (types, ranges); anything off → safe default `"Visitor at the door"`. |
| `caution` decided in Python, not by the model | Explainable in one sentence: *no uniform/badge and no package visible*. The model never labels a person suspicious. |

## 3. Weekly trend — `backend/engine/trends.py`

No model call: median first activity of the last 7 active days vs the 7 before; a shift of
30 min or more becomes e.g. *"Waking about 40 minutes later this week"*.
