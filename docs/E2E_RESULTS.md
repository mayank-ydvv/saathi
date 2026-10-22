# End-to-end results

Run on 2026-10-22 on a MacBook (Python 3.11, ring-sandbox 0.5.0, `STORAGE=memory`, no AWS
credentials, no Telegram token, so alerts went to the log channel). Each run was
`scripts/demo_run.sh <scenario>`: a real `ring-sandbox serve` emulator, real `uvicorn
backend.api.main:app`, seeding through `RingClient`, the emulator signing and delivering every
webhook, and the engine **stub** (Krishnaditya's engine and Bedrock digest are not merged yet).
Scenarios are the placeholders in `scripts/fallback_scenarios/` (Debadrita's aren't merged yet).

## fall_day: late start → full ladder → ack

```
06:50  motion_detected/human    Bedroom Cam      stored
06:52  motion_detected/human    Bedroom Cam      stored
07:30  motion_detected/human    Front Door       stored
10:20  scheduler tick -> late_start kitchen "No kitchen movement by 10:20 (usually 08:05)"
```

| Step | Demo-clock time (UTC) | Gap | Observed |
|---|---|---|---|
| SUSPECT | 04:50:00 | – | status `yellow` |
| NUDGE_PARENT | 04:50:10 | 10 s | `/nudge` active: "Good morning Kamala, are you okay? Please press the green button.", `audio_url` → `/blobs/audio/nudge-fallback.m4a` (200, audio/mp4, 46,722 B) |
| ALERT_FAMILY | 04:50:25 | 15 s | status `red`; family message: "Family alert for Kamala (Chennai) / No kitchen movement by 10:20 (usually 08:05) / Last seen: front door at 07:30" |
| ALERT_NEIGHBOUR | 04:50:45 | 20 s | neighbour message, same text |
| RESOLVED | 04:50:53 | – | `POST /alerts/{id}/ack {"by":"family","name":"Priya"}` → 200 in **1 ms**; second ack → 200 `RESOLVED`, first acker kept; status back to `green`, `/nudge` inactive |

Same run, ingest checks against the live API:
- Three identical signed deliveries → `200, 200, 200`; events went 3 → 4 (**stored once**).
- Wrong HMAC → `401 {"detail": "invalid webhook signature"}`; no signature → `401`.
- Every endpoint in contract 4.6 answered with its documented shape (digest → `404` before 21:00, as specified).

## night_door: rare-slot door activity

```
02:10  motion_detected/human    Front Door       stored
02:10  motion_detected/human    Front Door       stored
```
A `night_activity` alert ("Front door opened at 02:10") opened on the webhook itself (no tick
needed); the second door event 40 s later did **not** open a second alert. Ladder:
SUSPECT 20:40:00 → NUDGE_PARENT 20:40:09 → ALERT_FAMILY 20:40:26 (UTC), status `red`.

## scam_visitor: doorbell snapshot + visitor description

Normal morning (06:45 bedroom, 07:30 door, 08:05 kitchen, 10:00 living room), then at 11:30 a
person, a doorbell press and a person again. The `ding` event in the timeline has a
`snapshot_url` (fetched via `RingClient.snapshot_latest`, stored, served: 200 `image/png`) and a
`visitor` object. Status stayed `green` (no false alert from the morning).
- The visitor text is the stub's placeholder until the Bedrock `describe_visitor` lands.
- The emulator's snapshot is a 179-byte placeholder PNG. For the video, run the emulator with
  `--media-dir` and real test images (per the risk table in the plan).

## normal_day: calm day + evening digest

Eight events from 06:45 to 21:15 at 1200× (about 45 s of real time). No anomalies at any tick;
status `green` throughout. The 21:30 tick wrote the digest (template fallback, no Bedrock):
"Kamala's day on 22 Oct: first activity at 06:45, last at 21:15. Activity seen in the bedroom,
front door, kitchen, living room (8 events)."

## Acceptance criteria

| Criterion | Status |
|---|---|
| `fall_day` → SUSPECT → NUDGE_PARENT (nudge active with audio URL) → family message; ack resolves within 2 s | **Pass** locally (ack 1 ms). The family message went to the log channel: a **real Telegram message is not verified yet** (needs the bot token and chat IDs). Telegram payloads and button handling are covered by unit tests. |
| Every 4.6 endpoint returns the documented shape | **Pass** (`tests/backend/test_api.py` + live curl) |
| Duplicate webhooks never create duplicate events/alerts; bad HMAC → 401 | **Pass** (tests + live) |
| No `Scan` anywhere | **Pass**: the only "Scan" in `backend/` is `ScanIndexForward=False` (Query sort order); IAM grants no `dynamodb:Scan` |
| `pytest` and `ruff` pass; runs with `STORAGE=memory` and no AWS credentials | **Pass**: 124 tests; Polly and Bedrock fall back |
| `sam build` succeeds; deployed API answers `/health` | `sam build` + `sam validate --lint` **pass**; **not deployed yet** (needs AWS credentials and approval) |
| `ring_client.py` used on the real code path | **Pass**: seeding (`list_devices`) and doorbell snapshots (`latest_snapshot`) in every run |

## How to reproduce

```bash
source .venv/bin/activate
scripts/demo_run.sh fall_day          # leaves the stack running for the dashboard; Ctrl-C stops it
scripts/demo_run.sh normal_day --speed 1200 --exit
```
