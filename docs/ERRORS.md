# Error list: fixes

The 40 issues from the 2026-10-23 review, with what changed. IDs are the review's; code
comments cite them (e.g. `(H9)`). Tests: `tests/backend/test_error_list.py` unless noted.

## Critical

| ID | Fix | Test |
|---|---|---|
| C1 | `backend/api/auth.py`: with `AUTH_MODE=cognito` every data route needs the family's Cognito id token (RS256 signature checked against the pool's JWKS, plus issuer, audience, `token_use`, expiry) or, for the parent app's home/nudge/own "I'm okay", the tablet's `X-Device-Token`. The dashboard sends the token on every call; the parent app sends the device token. The stack sets `AUTH_MODE=cognito`. | `test_c1_*`, dashboard `auth.test.tsx`, parent `api.test.ts` |
| C2 | A token alone isn't enough: its email must be on the home's `family_emails` (stack parameter `FamilyEmails`, written by seeding). Self sign-up stays on, but a stranger gets 403. | `test_c2_*` |
| C3 | `DEMO_MODE` defaults to `false` (code and SAM). `/_dev/*` and the demo clock only exist with `DEMO_MODE=true` and `STORAGE=memory`, so never on AWS. | `test_c3_*`, `test_config_time.py` |
| C4 | `POST /_dev/seed` no longer takes a path; it only reads the configured fixtures file. | `test_api.py::test_dev_seed_and_blob_route` |
| C5 | `states:SendTaskSuccess` granted on `"*"` (the action has no resource type). Any other failure than an expired token is logged as an error. | cfn-lint |
| C6 | CORS origins are a stack parameter (`AllowedOrigins`) and a setting (`CORS_ORIGINS`); `authorization` and `x-device-token` are allowed headers. | cfn-lint |

## High

| ID | Fix | Test |
|---|---|---|
| H1 | An open alert older than 24 h is closed with `expired: true` when a new anomaly arrives, so monitoring never stops. | `test_h1_*` |
| H2 | Indoor movement after a late-start / long-inactivity alert opened resolves it as the parent (front-door camera and doorbell don't count). | `test_h2_*` |
| H3 | Alert ids use the real clock; the open alert is found through a per-home pointer, not "newest id". | `test_h3_*` |
| H4 | The "digested today" marker is set only after the digest was stored; a failure releases the claim and retries. | `test_h4_h5_*` |
| H5 | The tick and the 21:00 Lambda both go through `deliver_digest`, which claims the day with a conditional write first. | `test_h4_h5_*`, `test_store.py` |
| H6 | DynamoDB dedupe on `event_id` alone: an `id#<event_id>` marker written in the same transaction as the event. | `test_store.py` (both stores) |
| H7 | Voice caches the blob key, not the presigned URL; a fresh URL is made per request. | `test_voice.py` |
| H8 | The demo clock (and `DEMO_CLOCK_START`) is a local `STORAGE=memory` feature only, so Lambdas can't disagree on "now". | `test_c3_*` |
| H9 | Routine writes are conditional on a `rev` (`backend/common/routine_store.py`), retried on a lost race. | `test_store.py` |
| H10 | Opening an alert claims the home's open-alert pointer atomically; resolving releases it. | `test_store.py`, `test_h1_*` |

## Medium

| ID | Fix | Test |
|---|---|---|
| M1 | Longest quiet stretch also counts 06:00 → first event and last event → min(22:00, now). | `test_m1_*` |
| M2 | An anomaly dropped because another alert is open has its "fired today" marker cleared. | `test_m2_*` |
| M3 | Bedrock timeouts 3 s connect / 12 s read (worst case 30 s); the ingest Lambda skips the visitor description when less than 40 s remain. Moving it to an async Lambda is a follow-up. | `test_m3_*` |
| M4 | WebP needs `WEBP` at bytes 8–12; GIF and WebP get their own MIME types. | `test_m4_*` |
| M5 | Hindi mode speaks Hindi with the browser voice instead of the English Polly clip. | parent `App.test.tsx` |
| M6 | "Sound on" is not remembered across reloads; the Unlock tap comes back every page load. | parent `App.test.tsx` |
| M7 | Dashboard clock sync retries with back-off; only a 404 stops it. | dashboard `clock.test.ts` |
| M8 | `request()` turns a bad JSON body into an error, and polling keeps going if a fetcher throws. | dashboard tests |
| M9 | Tokens are renewed before every API call; only a rejected refresh token signs you out (offline keeps the session). | dashboard `auth.test.tsx` |
| M10 | The Telegram poller only moves past an update once it was handled (3 tries, then skip). | `test_m10_*` |
| M11 | No default HMAC key: the API and Lambdas refuse to start without one. | `test_config_time.py` |
| M12 | `react-router-dom` 7.18.4 (`npm audit`: 0 vulnerabilities). | dashboard build |

## Low

| ID | Fix |
|---|---|
| L1 | The ladder makes the nudge clip once and stores its text and key on the alert; `/nudge` reuses them. |
| L2 | "Hello" / "नमस्ते" before 05:00 instead of "Good morning" (backend and parent app). |
| L3 | The parent app speaks the backend's own message (same greeting as the clip) in English. |
| L4 | No "()" in alerts when the home has no city. |
| L5 | Kitchen visits only count as meals during waking hours. |
| L6 | The rooms ring waits for the home, counts only activity events and known rooms; "Family watching" shows the demo family only in mock mode (the signed-in person otherwise). |
| L7 | "No activity recorded yet" (not "today") when nothing was ever seen. |
| L8 | Header time label uses the home's city; login copy no longer says "Ma". |
| L9 | Bedrock reads its model and region through `Settings`. |
| L10 | Seeding writes the first `HOME_IDS` home, not always `home-demo-1`. |
| L11 | Production builds use same-origin paths when `VITE_*` URLs are unset, never localhost. |
| L12 | Dashboard screens are lazy-loaded: the entry chunk went from 828 kB to 423 kB, no Vite warning. |
