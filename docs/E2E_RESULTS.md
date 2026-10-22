# End-to-end results

Latest run: 2026-10-22, 22:40 IST, on a MacBook (Python 3.11, ring-sandbox 0.5.0, `STORAGE=memory`,
no AWS credentials, no Telegram token, so alerts went to the log channel).

Each run was `TICK_SECONDS=1 scripts/demo_run.sh <scenario> --speed 1200 --exit`: a real
`ring-sandbox serve` emulator, real `uvicorn backend.api.main:app`, seeding through `RingClient`,
Krishnaditya's real engine, digest and 14-day fixtures (`sandbox/fixtures/`), Debadrita's scenarios
(`sandbox/scenarios/`), and the emulator signing and delivering every webhook. Ticking every second
(instead of every 60 s) is deliberate: it gives the scheduler a chance to fire between every pair of
events, so timing-dependent false alerts show up.

| Scenario | Alert raised | Status after | Matches `sandbox/scenarios/README.md` |
|---|---|---|---|
| `normal_day` | none (22:00 tick: no anomalies) | green | yes |
| `fall_day` | `long_inactivity`: "No movement anywhere for 4 h 5 min (last: living room at 13:00)" | yellow → ladder | yes |
| `late_morning` | `late_start` kitchen: "No kitchen movement by 08:50 (usually 07:50)" | red, full ladder | yes |
| `night_door` | `night_activity`: "Front door opened at 02:10 — unusual for this hour" | red, full ladder | yes |
| `scam_visitor` | none from the routine checks | green | yes |
| `aide_visit` | none | green | yes |

## Two bugs earlier runs missed

The first version of this file (all green) was recorded with the engine stub and 60-second ticks.
Running with the real engine and 1-second ticks exposed two problems, both now fixed:

1. **Late start fired for every zone** (engine, fixed in #15). With the fixtures' usual front-door
   time of 06:28, a normal day raised "No front door movement by 07:30" and, because only one alert is
   open per home, that false alert hid the real kitchen alert in `fall_day`. Late start now only
   checks the kitchen and bedroom.
2. **A real-clock tick before the demo clock was set** (`scripts/demo_run.sh`). The scheduler could
   tick on the real time (e.g. 22:28) between seeding and the driver's first clock move, see "nothing
   today" and open "No bedroom movement by 22:28" for the rest of the demo. Reproduced in every
   scenario before the fix; `demo_run.sh` now sets the demo clock to `story_start` before seeding.

## Escalation ladder and ack (from the earlier `fall_day` run)

| Step | Gap | Observed |
|---|---|---|
| SUSPECT → NUDGE_PARENT | 10 s | `/nudge` active with the message and an `audio_url` (fallback clip, 200 audio/mp4) |
| → ALERT_FAMILY | 15 s | status `red`; family message with the reason and "Last seen: front door at 07:30" |
| → ALERT_NEIGHBOUR | 20 s | neighbour message |
| ack | – | `POST /alerts/{id}/ack` → 200 in 1 ms; second ack returns the same `RESOLVED`; status back to `green` |

Ingest checks against the live API: three identical signed deliveries → stored once; wrong HMAC →
`401 {"detail": "invalid webhook signature"}`; no signature → `401`.

## Acceptance criteria

| Criterion | Status |
|---|---|
| Alert → NUDGE_PARENT (nudge with audio URL) → family message; ack resolves within 2 s | **Pass** locally. A **real Telegram message is not verified yet** (needs the bot token and chat IDs); Telegram payloads and button handling are unit-tested. |
| Every 4.6 endpoint returns the documented shape | **Pass** (`tests/backend/test_api.py` + live curl) |
| Duplicate webhooks never duplicate events/alerts; bad HMAC → 401 | **Pass** (tests + live) |
| No `Scan` anywhere | **Pass**: the only "Scan" in `backend/` is `ScanIndexForward=False` (Query sort order); IAM grants no `dynamodb:Scan` |
| `pytest` and `ruff` pass; runs with `STORAGE=memory` and no AWS credentials | **Pass**; Polly and Bedrock fall back |
| `sam build` succeeds; deployed API answers `/health` | `sam build` + `sam validate --lint` **pass**; **not deployed yet** (needs AWS credentials and approval) |
| `ring_client.py` used on the real code path | **Pass**: seeding (`list_devices`) and doorbell snapshots (`latest_snapshot`) |

## How to reproduce

```bash
source .venv/bin/activate
TICK_SECONDS=1 scripts/demo_run.sh fall_day --speed 1200 --exit
scripts/demo_run.sh fall_day      # leaves the stack running for the dashboard; Ctrl-C stops it
```
