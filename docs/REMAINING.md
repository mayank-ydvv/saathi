# What's left before submission

Audit of `main` (2026-10-23) against the plan in the project report ("Saathi — Elder-Care Guardian
on Ring") and each member's build prompt. Tick items off here as they land.

## Done

| Report item | Where |
|---|---|
| Routine learning (96 slots × 14 days, median/MAD) | `backend/engine/routine.py` |
| Anomaly checks: late start, long inactivity, night activity | `backend/engine/anomaly.py` |
| Escalation ladder: SUSPECT → nudge → family → neighbour → resolved | `backend/escalation/` (local asyncio + Step Functions ASL) |
| Ring integration: `RingClient` for devices + snapshots, HMAC webhook | `backend/ingest/` |
| 4 DynamoDB tables, S3, REST API (contract 4.6) | `backend/common/`, `backend/api/` |
| Evening digest + visitor description (Bedrock, with fallbacks) + weekly trend in the digest | `backend/digest/`, `backend/engine/trends.py` |
| Family dashboard (Today, Alerts, Digest, Routine; mock + real API; demo switch) | `dashboard/` |
| Parent app (big clock, voice nudge, "I'm okay", English/हिन्दी) | `parent-app/` |
| Six demo scenarios + runner | `sandbox/scenarios/` |
| AWS SAM stack (Lambdas, EventBridge, Step Functions, Polly, SNS), `sam build` passes | `infra/` |
| Open source: routine-guard (MIT, public) + ring-sandbox PR | [routine-guard](https://github.com/krishnadityasingh18-create/routine-guard), [ring-sandbox#19](https://github.com/josepha-mayo/ring-sandbox/pull/19) (open, awaiting maintainer) |
| README, architecture diagram, FEEDBACK.md, demo script, Devpost text | `README.md`, `docs/` |
| Local end-to-end run of every scenario | `docs/E2E_RESULTS.md` |

## Could be done without accounts (all done)

- [x] **Engine bug** (fixed in #30): a stored routine without `day_slots` drifts after rollover (`days_seen` resets while `hist` / `first_times` keep growing past 14). Raised in the #6 review, still open. Owner: Krishnaditya (fixing for him).
- [x] **CI** (#32): the frontend jobs only run `npm run build`; also run `npm run lint` and `npm test` (dashboard 54 tests, parent app tests). Owner: Mayank.
- [x] **README** (#33): the features table still says the family dashboard is "not in `main` yet", and Quick start doesn't say how to run it. Owner: Debadrita (fixing for her).
- [x] **FEEDBACK.md** (#34): missing the dashboard's tools (React Router, Testing Library/jsdom, npm 11) from `docs/feedback/anushka.md`. Owner: Debadrita (fixing for her).

## Needs your accounts, money or a decision

| Item | Why it matters | What's needed | Who |
|---|---|---|---|
| Real Telegram alert with the "I'm checking" button | Acceptance criterion; the 0:45 shot of the video | Create the bot with BotFather and the family/neighbour chats; put `TELEGRAM_BOT_TOKEN` and the two chat IDs in `.env` (never in git). Then we verify it. | Mayank |
| Live Bedrock (digest + visitor caution) | AWS Builder entry; the 1:05 scam-visitor shot needs the `caution` flag | Bedrock model access in the AWS console + `BEDROCK_MODEL_ID` | Mayank, Krishnaditya |
| AWS deploy + `/health` on the deployed API | Acceptance criterion; AWS Builder entry | AWS credentials, then `sam deploy --guided` (stays in the free tier except a few cents of Bedrock) | Mayank |
| One real Ring Partner API call | Report: "show at least one real Ring Partner API call if we get a playground token" | A Ring Playground token (optional; the emulator covers the rest) | Mayank |
| Doorbell test photos | `scam_visitor` / `aide_visit` shots; the emulator's snapshot is a tiny placeholder | Two images (a stranger with no uniform or package, a uniformed aide): own photos with consent or AI-generated, no copyrighted images; serve with `ring-sandbox serve --media-dir` | Debadrita |
| ~~Night alerts: once a day per zone, or again after 30 minutes?~~ **Done:** again after 30 min, max 3 a night (`EngineConfig`) | A second door opening at 03:00 after a resolved 02:10 alert currently doesn't alert | A product decision; the change is one line in `backend/engine/anomaly.py` | Team |
| Protect `main` (require PR + passing CI) | Report's GitHub workflow | GitHub → Settings → Branches | Mayank |
| Demo video (< 3 min, public, English) | Required for submission | Record and edit following `docs/DEMO_SCRIPT.md`; upload to YouTube | Debadrita |
| Devpost submission | Required | Paste `docs/DEVPOST.md`, video link, repo link, Open Source fields from `docs/OPEN_SOURCE.md`; choose Ring track + AWS Builder + Open Source | Team |

## Optional extras (not in the MVP)

- Weekly trend on the dashboard (it's already in the evening digest). Needs a new field on
  `GET /homes/{id}/routine`, which is a contract change, so agree it first.
- Delete merged branches on GitHub to tidy the branch list.
