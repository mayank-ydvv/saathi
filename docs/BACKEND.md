# Backend notes

How the backend is put together, and the optional settings that are not in `.env.example`
(that file mirrors contract 4.7 exactly). The shared shapes live in [CONTRACTS.md](CONTRACTS.md).

## Layout

| Folder | What lives there |
|---|---|
| `backend/common/` | settings, demo clock, time helpers, the `Store` interface with memory and DynamoDB/S3 implementations, the engine import facade (re-exports `backend/engine` and `backend/digest`) |
| `backend/ingest/` | `RingGateway` (ring-sandbox `RingClient`), webhook normalization, the ingest pipeline, `POST /webhooks/ring`, demo-home seeding |
| `backend/escalation/` | alert records and dedupe, the escalation ladder, notifiers, voice nudge, Step Functions definition |
| `backend/api/` | FastAPI app and REST endpoints (contract 4.6) |
| `backend/handlers/` | AWS Lambda entry points |

## Optional environment variables

| Variable | Default | Meaning |
|---|---|---|
| `HOME_IDS` | `home-demo-1` | Comma-separated homes the scheduler and webhook routing look at (no table scans, so homes are listed here) |
| `DEMO_CLOCK_START` | empty | ISO time the demo clock starts at, e.g. `2026-10-22T10:20:00+05:30`. Also settable at runtime with `POST /_dev/clock` |
| `VISITOR_DESCRIPTIONS` | `true` | Call `describe_visitor` on doorbell snapshots |
| `TABLE_PREFIX` | empty | Prefix for DynamoDB table names (`<prefix>saathi-events`, ...) |
| `BLOB_BUCKET` | empty | S3 bucket for snapshots, audio and digests (STORAGE=dynamo) |
| `SNS_TOPIC_ARN` | empty | Optional second alert channel |
| `ESCALATOR` | `local` | `local` (asyncio timers) or `stepfunctions` |
| `STATE_MACHINE_ARN` | empty | Escalation state machine (ESCALATOR=stepfunctions) |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | Base for blob URLs in memory mode and for links in messages |
| `TELEGRAM_MODE` | `poll` | `poll` (getUpdates loop, local) or `webhook` (Telegram calls `/telegram/webhook`, AWS) |
| `TELEGRAM_WEBHOOK_SECRET` | empty | `secret_token` given to Telegram `setWebhook`; checked on `/telegram/webhook` |
| `ROUTINES_FILE` | `sandbox/fixtures/routines_home-demo-1.json` | Backfill output loaded by seeding |
| `FAMILY_NAME`, `NEIGHBOUR_NAME` | `Priya`, `Ravi` | Contact names used in messages and acks |
| `PARENT_PHONE` | empty | The parent's phone number, stored on the home when seeding; the dashboard shows a "Call" button only when it is set |

## Design notes

- **Event ids**: `evt_` + the first 16 hex chars of sha256(Ring webhook `data.id`). Ring retries a
  failed delivery with the same event, so the same id comes back and the conditional put drops it.
- **Alert ids**: `alt_` + 12 hex digits of epoch milliseconds + 4 random hex. They sort by creation
  time, so "newest N alerts" is a reverse Query with `Limit`, and the open alert (at most one per
  home) is always the newest.
- **Digests** are stored as JSON blobs (`digests/<home_id>/<date>.json`), so no fifth table.
- **Night check order**: `check_event` runs against the routine *before* the event is folded in,
  so a rare slot isn't made "less rare" by the event being judged.
- **Demo clock**: `ring-sandbox play` emits events near real time. For a deterministic video the
  backend runs on real time plus an offset; incoming Ring timestamps are shifted by the same offset,
  while snapshot requests use the original Ring time.
