# Shared contracts

This is the team's single source of truth. Everyone codes against these contracts; change them only after telling the whole team (raise it under "Contract change requests" in a PR).

## Accepted changes

| Change | Why | Agreed in |
|---|---|---|
| `Routine.day_slots: list[list[int]]` (last field, default `[]`) | Lets the day that leaves the 14-day window be subtracted from `hist` without a scan | PR #6 review |
| The engine counts only `motion.human`, `motion` and `ding` as activity; `package` and `vehicle` are stored but ignored | A passing car or a parcel isn't evidence that the parent is up | PR #6 review |
| `Routine.fired: dict[str, str]` (anomaly kind -> local ISO date it last fired, default `{}`) | Each anomaly kind fires at most once a local day; callers persist routines after a check that returned one | PR #8 |
| `GET /homes/{home_id}` also returns `contacts: [{"role": "family" \| "neighbour", "name": str}]` and `parent_phone: str \| null` (both additive) | The dashboard's Family page names who each escalation step reaches, and "Call" dials the parent | dashboard refined-warm PR |

## 4. SHARED CONTRACTS (everyone codes against these — do not change them)

### 4.1 Constants
- `DEMO_HOME_ID = "home-demo-1"`
- `TIMEZONE = "Asia/Kolkata"` — slots, "today", usual times and all user-facing times are computed in this timezone.
- Zones: `"front_door"`, `"kitchen"`, `"living_room"`, `"bedroom"`.
- Day = 96 slots of 15 minutes. Slot index = `(local_hour * 60 + local_minute) // 15` (0..95).
- History window `D = 14` days.
- Timestamps are stored and sent as UTC ISO-8601 strings ending in `Z`, e.g. `"2026-10-22T03:15:00Z"`. Frontends convert to Asia/Kolkata for display.

### 4.2 Normalized event (internal + JSON)
```json
{
  "event_id": "evt_123",
  "home_id": "home-demo-1",
  "device_id": "dev_kitchen_cam",
  "zone": "kitchen",
  "type": "motion.human",
  "ts": "2026-10-22T03:15:00Z",
  "snapshot_key": null
}
```
`type` is one of the Ring event types we use: `"motion.human"`, `"motion"`, `"ding"`, `"package"`, `"vehicle"` (others are stored but ignored by the engine). `snapshot_key` is an S3 key / local path when a snapshot was saved, else `null`.

### 4.3 Engine interface (owned by Krishnaditya, called by Mayank) — `backend/engine/`
```python
# backend/engine/models.py  (dataclasses, slots=True)
@dataclass
class Event:          # mirrors 4.2
    event_id: str; home_id: str; device_id: str; zone: str; type: str
    ts: datetime      # timezone-aware UTC
    snapshot_key: str | None = None

@dataclass
class Routine:        # one per (home_id, zone)
    home_id: str; zone: str
    hist: list[int]               # length 96, count of active days per slot over the window
    days_seen: int                # number of days contributing to hist (<= D)
    first_times: list[int]        # first-activity minute-of-day for each of the last <= D days
    median_first: int | None      # minutes after local midnight
    mad_first: int | None         # minutes
    last_event_ts: datetime | None
    today: date | None            # local date currently being accumulated
    today_first: int | None       # first-activity minute today, None if no activity yet
    today_slots: set[int]         # slots active today (so a slot counts once per day)
    day_slots: list[list[int]] = []  # active slots of each closed day in the window, oldest first (added, PR #6)
    fired: dict[str, str] = {}       # anomaly kind -> local ISO date it last fired (added, PR #8)

@dataclass
class Anomaly:
    home_id: str
    kind: str          # "late_start" | "long_inactivity" | "night_activity"
    zone: str | None   # None for home-wide checks (long_inactivity)
    reason: str        # human sentence, e.g. "No kitchen movement by 10:15 (usually 08:05)"
    detected_at: datetime
    details: dict

@dataclass
class EngineConfig:
    late_buffer_min_floor: int = 30      # minimum buffer added to the median
    mad_multiplier: float = 3.0
    inactivity_minutes: int = 240
    waking_start: str = "06:00"          # inactivity is only checked between these
    waking_end: str = "22:00"
    night_rare_ratio: float = 0.05
    min_days_for_checks: int = 5         # below this, use cold-start defaults
    default_first_activity: str = "08:00"
```
Functions (pure, no AWS, no I/O):
```python
# backend/engine/routine.py
def new_routine(home_id: str, zone: str) -> Routine
def update_on_event(r: Routine, e: Event, tz: str = "Asia/Kolkata") -> Routine        # O(1)
def rollover_day(r: Routine, new_day: date) -> Routine                                  # O(D log D), once a day
def routine_to_dict(r: Routine) -> dict ;  def routine_from_dict(d: dict) -> Routine    # DynamoDB-safe (ints only, no floats)

# backend/engine/anomaly.py
def check_event(r: Routine, e: Event, cfg: EngineConfig, tz: str = "Asia/Kolkata") -> Anomaly | None          # night_activity, O(1)
def check_tick(routines: dict[str, Routine], now: datetime, cfg: EngineConfig, tz: str = "Asia/Kolkata") -> list[Anomaly]  # late_start + long_inactivity, O(zones)

# backend/engine/backfill.py
def build_routines(events: Iterable[Event], tz: str = "Asia/Kolkata") -> dict[str, Routine]   # zone -> Routine
# CLI: python -m backend.engine.backfill --input sandbox/fixtures/normal_14_days.jsonl --output sandbox/fixtures/routines_home-demo-1.json
```
Digest (owned by Krishnaditya, called by Mayank) — `backend/digest/`:
```python
def generate_digest(home: dict, events: list[Event], alerts: list[dict], day: date) -> str      # 80–120 words, never invents facts
def describe_visitor(image_bytes: bytes) -> dict
# returns {"summary": str, "person_count": int, "uniform_or_badge": bool,
#          "carrying_package": bool, "caution": bool, "caution_reason": str}
def weekly_trend(routine: Routine) -> str | None    # e.g. "Waking about 40 minutes later this week"
```

### 4.4 Alerts and escalation states
States in order: `"SUSPECT"` → `"NUDGE_PARENT"` → `"ALERT_FAMILY"` → `"ALERT_NEIGHBOUR"` → `"RESOLVED"`. Any acknowledgement moves straight to `"RESOLVED"`.
Default waits (env-configurable): SUSPECT 300 s, NUDGE_PARENT 300 s, ALERT_FAMILY 600 s. Demo mode: 10–20 s each.
Alert record (JSON, also the API shape):
```json
{
  "alert_id": "alt_8f2c",
  "home_id": "home-demo-1",
  "kind": "late_start",
  "zone": "kitchen",
  "reason": "No kitchen movement by 10:15 (usually 08:05)",
  "state": "ALERT_FAMILY",
  "created_at": "2026-10-22T04:45:00Z",
  "resolved_at": null,
  "acked_by": null,
  "steps": [
    {"state": "SUSPECT", "at": "2026-10-22T04:45:00Z"},
    {"state": "NUDGE_PARENT", "at": "2026-10-22T04:50:00Z"},
    {"state": "ALERT_FAMILY", "at": "2026-10-22T04:55:00Z"}
  ]
}
```
`acked_by` when resolved: `{"by": "parent" | "family" | "neighbour", "name": "Priya"}`.
Home status rule: `red` if an open alert is in ALERT_FAMILY or ALERT_NEIGHBOUR; `yellow` if an open alert is in SUSPECT or NUDGE_PARENT; otherwise `green`.

### 4.5 Storage (DynamoDB on AWS, in-memory locally)
| Table | Partition key | Sort key | Fields |
|---|---|---|---|
| `saathi-events` | `home_id` | `ts` (ISO string + `#` + event_id) | event fields from 4.2 |
| `saathi-routine` | `pk` = `home_id#zone` | – | `routine_to_dict` output |
| `saathi-alerts` | `home_id` | `alert_id` | alert record from 4.4 |
| `saathi-homes` | `home_id` | – | parent_name, city, devices `{device_id: zone}`, contacts, digest_time |
All reads are by key or `Query` on the partition key with a sort-key range. Never `Scan`.

### 4.6 REST API (FastAPI) — base URL from env (`VITE_API_BASE`, default `http://localhost:8000`)
| Method | Path | Response (200) |
|---|---|---|
| GET | `/health` | `{"ok": true}` |
| POST | `/webhooks/ring` | `{"ok": true}` (HMAC-verified; 401 on bad signature) |
| GET | `/homes/{home_id}` | `{"home_id","parent_name","city","zones":["front_door",...]}` |
| GET | `/homes/{home_id}/status` | `{"home_id","status":"green\|yellow\|red","reason": str\|null,"last_seen":{"zone": str,"ts": str}\|null,"active_alert_id": str\|null}` |
| GET | `/homes/{home_id}/timeline?date=YYYY-MM-DD` | `{"date": str,"events":[{"event_id","ts","zone","type","snapshot_url": str\|null,"visitor": dict\|null}]}` (sorted by ts) |
| GET | `/homes/{home_id}/alerts?limit=20` | `{"alerts":[<alert record>...]}` (newest first) |
| POST | `/alerts/{alert_id}/ack` | body `{"by":"parent\|family\|neighbour","name": str}` → `{"alert_id","state":"RESOLVED"}` |
| GET | `/homes/{home_id}/digest?date=YYYY-MM-DD` | `{"date","text","generated_at"}` or 404 |
| GET | `/homes/{home_id}/routine` | `{"zones":[{"zone","usual_first":"08:05"\|null,"hist":[96 ints],"days_seen": int}]}` |
| GET | `/homes/{home_id}/nudge` | `{"active": bool,"alert_id": str\|null,"message": str\|null,"audio_url": str\|null}` |
CORS allows `http://localhost:5173` (dashboard) and `http://localhost:5174` (parent app). Errors: `{"detail": "message"}` with proper status codes.

### 4.7 Environment variables (`.env.example`)
```
STORAGE=memory                 # memory | dynamo
AWS_REGION=us-east-1
RING_API_BASE=http://localhost:8787
RING_TOKEN=dummy
RING_WEBHOOK_HMAC_KEY=change-me
TELEGRAM_BOT_TOKEN=
TELEGRAM_FAMILY_CHAT_ID=
TELEGRAM_NEIGHBOUR_CHAT_ID=
BEDROCK_MODEL_ID=
DEMO_MODE=true
ESC_WAIT_SUSPECT=300
ESC_WAIT_NUDGE=300
ESC_WAIT_FAMILY=600
TICK_SECONDS=60
VITE_API_BASE=http://localhost:8000
VITE_HOME_ID=home-demo-1
VITE_USE_MOCK=true
```

### 4.8 Tech versions
Python 3.11, FastAPI, pydantic v2, boto3, pytest, ruff (lint + format). Frontends: Node 20, React 18, Vite, TypeScript (strict), Tailwind CSS, Vitest. No other heavy frameworks without a reason in the PR.
