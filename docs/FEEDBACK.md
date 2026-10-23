# Product feedback

What we thought of every tool, API, SDK and service we built Saathi with, written as we built it.
This file compiles the per-member notes in [`docs/feedback/`](feedback/) (Mayank: backend and AWS;
Krishnaditya: engine and Bedrock; Debadrita: scenarios, parent app, docs; Anushka: family
dashboard). Where nobody has written notes yet, the section says so instead of guessing.

Compiled on 2026-10-22. **Status:** the whole system runs locally (`STORAGE=memory`). The AWS
stack builds and validates (`sam build`, `sam validate --lint`) but has **not been deployed yet**,
so live calls to Bedrock, Polly, Lambda, Step Functions and the other AWS services are still to
come.

## AWS services we used and how

| Service | How Saathi uses it | Where |
|---|---|---|
| **Amazon Bedrock** | Writes the family's evening digest from the day's events and describes doorbell visitors from the snapshot (Converse API, text and image). Falls back to a template digest without Bedrock access. | `backend/digest/` |
| **Amazon Polly** | Speaks the nudge to the parent ("Good morning Kamala, are you okay? …") with the neural Kajal voice (en-IN), cached by text hash so each phrase is synthesized once. | `backend/escalation/voice.py` |
| **AWS Step Functions** | The escalation ladder on AWS: one execution per alert, `waitForTaskToken` Tasks with timeouts; an acknowledgement sends `SendTaskSuccess` and resolves it at once. | `backend/escalation/state_machine.asl.json` |
| **AWS Lambda** | Five functions: the REST API (FastAPI via Mangum), webhook ingest, the minute tick, the evening digest and each escalation step. | `backend/handlers/`, `infra/template.yaml` |
| **Amazon EventBridge** | Two schedules: `rate(1 minute)` for the late-start / inactivity checks, and `cron(30 15 * * ? *)` = 21:00 IST for the digest. | `infra/template.yaml` |
| **Amazon API Gateway** | HTTP API in front of the API and ingest Lambdas, including `POST /webhooks/ring`. | `infra/template.yaml` |
| **Amazon DynamoDB** | Four on-demand tables (events, routine, alerts, homes). Every read is by key or a `Query`; no IAM policy grants `Scan`. | `backend/common/dynamo_store.py` |
| **Amazon S3** | Private bucket for doorbell snapshots, nudge audio and digests, served through presigned URLs. | `backend/common/dynamo_store.py` |
| **Amazon SNS** | Optional second alert channel next to Telegram (an email subscription in the SAM template). | `backend/escalation/notifier.py` |
| **AWS SAM** | The whole stack in one template: tables, bucket, HTTP API, Lambdas, schedules, state machine, SNS. | `infra/` |

## Feedback by tool

### Ring Partner API
- **Used for:** the API shape our integration is written against: the `RingClient` calls for devices, history and snapshots, and Ring's signed webhooks.
- **Status:** we had no physical device and no playground token, so every call so far went to the ring-sandbox emulator below. Feedback on the live API will follow if we get a token.

### ring-sandbox (PyPI 0.5.0): Mayank, Debadrita
- **Used for:** the offline Ring Partner API emulator we develop and demo against: the typed `RingClient`, webhook HMAC helpers, and scripted scenarios of a parent's day.
- **Worked well:**
  - The README is unusually complete (fidelity table, webhook signing, CLI).
  - `webhooks.verify()` / `webhooks.parse()` handle the raw-body HMAC correctly; 168 of 168 test deliveries verified.
  - The bundled pytest plugin runs the emulator in-process, so ingest tests make real `RingClient` calls with no sockets.
  - The scenario format is tiny, so writing a whole day took minutes. `run(start=…)` lets you pin events to real clock times.
  - Device ids are free-form.
- **Needs work:**
  - Webhook types (`motion_detected` + `sub_type=human`, `button_press`) differ from history types (`motion`, `ding`), and the mapping isn't written down in one place.
  - The default world has no indoor cameras.
  - `ring-sandbox play` has no start-time option (a scenario always ends "now"), and `inject` has no `--at`, though `POST /_sandbox/events` accepts `at`.
  - An unknown `device:` name in a scenario is a raw `KeyError` traceback.
  - The 0.5.0 wheel doesn't match the GitHub `main` README: an empty snapshot window returns a frame instead of `416`, and offline devices aren't rejected on media. The placeholder snapshot is a PNG even when JPEG is requested.
- **Onboarding:** install to `ring-sandbox --help` in about 2 minutes; first in-process `RingClient` test in about 15; first played scenario in about 10.
- **Build with it again?** Yes. It's the only way to test a Ring partner integration without hardware.
- **As open-source contributors** (our [elder-care scenarios PR](https://github.com/josepha-mayo/ring-sandbox/pull/19)): CONTRIBUTING.md names scenario files as a top contribution and gives exact commands. The example tests cover new files automatically, and the suite (92 tests) ran green on Windows in about a minute. One surprise: examples must sit at the top level of `examples/`, because the loader doesn't look in sub-folders.

### Amazon Bedrock: Krishnaditya
- **Used for:** the evening digest text and doorbell visitor descriptions (`backend/digest/`).
- **Worked well:** the Converse API uses one request shape for text and images across models, and `system`, `messages` and `inferenceConfig` are clear. The botocore service model (`get_service_model("bedrock-runtime")`) let us verify every field name offline before writing code.
- **Needs work:** there's no way to request strict JSON output without tool-use boilerplate, so we validate and fall back ourselves. Timeouts and retries live in botocore `Config`, not on the Converse docs page, so they're easy to miss.
- **Onboarding:** request shape in minutes; live calls still pending AWS credentials and model access.
- **Build with it again?** Yes: a model-agnostic API that's easy to mock in tests.

### Amazon Polly: Mayank
- **Used for:** the spoken nudge on the parent app.
- **Worked well:** the "Available voices" table is clear about engines per voice, and Kajal gives a natural neural en-IN voice.
- **Needs work:** bilingual voices (Kajal, Aditi) need `LanguageCode`, or they may read English text with the other language's rules. The table marks them with an asterisk, but the `synthesize_speech` examples don't mention it. Region availability for neural voices is on a separate page.
- **Onboarding:** about 10 minutes from the docs to a working call shape.
- **Build with it again?** Yes.

### AWS Step Functions: Mayank
- **Used for:** the escalation ladder on AWS.
- **Worked well:** the callback-token pattern maps one-to-one onto "wait N minutes unless someone acknowledges". `TimeoutSecondsPath` lets the demo pass 10–20 s waits without a second state machine.
- **Needs work:** a late `SendTaskSuccess` for a Task that already timed out raises `TaskTimedOut`. That's expected, but every caller must catch it; an idempotent "ignore if finished" option would help.
- **Onboarding:** about 30 minutes to design the ASL; local testing needs fakes.
- **Build with it again?** Yes.

### AWS SAM CLI 1.169: Mayank
- **Used for:** the whole AWS stack and `sam build` packaging.
- **Worked well:** `sam validate --lint` (cfn-lint built in) works offline with no credentials. `DefinitionSubstitutions` keeps the state machine as a plain, testable JSON file.
- **Needs work:** the Python builder has no ignore file, so a monorepo either packages everything (frontends, `.venv`) or switches to `BuildMethod: makefile`. An unquoted `Path: /{proxy+}` in a YAML flow mapping fails with a parser error that doesn't hint at quoting.
- **Onboarding:** about 20 minutes from install to the first successful `sam build`, mostly spent on packaging.
- **Build with it again?** Yes, starting from the makefile builder.

### AWS Lambda, Amazon EventBridge, Amazon API Gateway, Amazon DynamoDB, Amazon S3, Amazon SNS
- **Used for:** see the table above.
- **Feedback:** not written yet. These are exercised only after the first deploy; local runs use the in-memory store, asyncio timers and moto in tests. Mayank will add notes after deploying.

### Telegram Bot API: Mayank
- **Used for:** family and neighbour alerts with an inline "I'm checking" button; pressing it acknowledges the alert.
- **Worked well:** plain HTTPS JSON. Long polling (`getUpdates` with `timeout`) delivers button presses in about a second without a public URL.
- **Needs work:** `callback_data` is limited to 64 bytes, and you must call `answerCallbackQuery` or the button keeps spinning on the user's phone.
- **Onboarding:** minutes from BotFather to the first message.
- **Build with it again?** Yes: free and instant for demos.

### Python standard library (`zoneinfo`, `statistics`, `dataclasses`): Krishnaditya
- **Used for:** routine learning: local-time slots and the median/MAD of first activity.
- **Worked well:** `zoneinfo` + `astimezone` made the Asia/Kolkata midnight boundary trivial. `dataclass(slots=True)` let us add a field without breaking constructors.
- **Needs work:** on Windows, `zoneinfo` silently depends on the `tzdata` package, and nothing in the error points you there. (This bit two of us.)
- **Build with it again?** Yes: the engine core has no dependencies.

### Vite, React 18, Tailwind CSS 4, Vitest: Debadrita, Anushka
- **Used for:** the parent app (`parent-app/`) and the family dashboard (`dashboard/`).
- **Worked well:** Tailwind 4's Vite plugin needs no PostCSS or config file, and `@theme` CSS variables made a small, high-contrast palette easy to keep consistent. `vitest` with jsdom and fake timers tested 3 s polling and the 5 s thank-you screen without waiting.
- **Needs work:** `@testing-library/user-event` v14 hangs under Vitest fake timers even with `delay: null`; we switched to `fireEvent`. Vite 7 requires Node 20.19 or newer; we stayed on Vite 6, which supports every Node 20 release the contract allows.
- **Also (dashboard):** design tokens as CSS variables mapped with `@theme inline` give dark mode in one `prefers-color-scheme` block; the difference between `@theme` and `@theme inline` (needed when a token points at a variable that changes per scheme) is easy to miss in the docs.
- **Onboarding:** about 15 minutes to a running app.
- **Build with it again?** Yes.

### React Router 6.30 and Testing Library + jsdom: Anushka
- **Used for:** the dashboard's four tabs, and screen tests that click "I'm checking" on mock data.
- **Worked well:** role/name queries (`getByRole("region", { name: "Open alert" })`) double as an accessibility check; `MemoryRouter` makes screen tests easy.
- **Needs work:** every test run printed two React Router "v7 future flag" warnings until both `BrowserRouter` and `MemoryRouter` got `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}`; the warning doesn't say test routers need it too. jsdom has no `HTMLDialogElement.showModal()`, so the visitor panel needs a fallback in tests.
- **Build with it again?** Yes.

### npm 11: Anushka
- **Used for:** installing the frontends.
- **Needs work:** `npm install` prints `npm warn allow-scripts esbuild (postinstall …)` and skips esbuild's install script. Vite still works (the binary comes from esbuild's platform package), but the warning doesn't say whether anything is broken, and CI's npm 10 behaves differently.
- **Build with it again?** Yes.

### Excalidraw: Debadrita
- **Used for:** the architecture diagram (`docs/architecture.excalidraw` → `docs/architecture.png`).
- **Worked well:** the file is plain JSON, so the diagram can be generated and reviewed like code, and the current release renders it as written.
- **Needs work:** the older `@excalidraw/utils` 0.1.2 package ignores `lineHeight` and `roundness`, so labels overlap and straight arrows curve. Easy to mistake for a broken file.
- **Build with it again?** Yes.

### ruff, pytest, uv: Mayank, Krishnaditya, Debadrita
- **Used for:** lint, format and tests for all Python; uv for the virtualenv.
- **Worked well:** fast, and one config in `pyproject.toml`.
- **Needs work:** `ruff format --check .` also formats Python blocks inside Markdown, so our verbatim contract doc failed CI until we excluded `*.md`. The error points at the `.md` file but doesn't say why Markdown is in scope.
- **Build with it again?** Yes.

## Friction log

| Who | Task attempted | Where it broke | How we fixed it |
|---|---|---|---|
| Mayank | Keep the contract doc verbatim and pass `ruff format --check` | ruff reformatted Python snippets inside the Markdown | Excluded `*.md` from `ruff format` |
| Mayank | Test "no snapshot when nothing was recorded" | The 0.5.0 wheel returned a frame, unlike the README's 416 | Read the installed `emulator.py`; simulated the 416 in our test |
| Mayank | Store doorbell snapshots as JPEG | The emulator's placeholder is a PNG | Detect the image type from magic bytes before saving |
| Mayank | Name a pydantic field `date` next to `from datetime import date` | `TypeError … NoneType` at import | Renamed the field to `day` |
| Mayank | Keep tests from touching real AWS | boto3 can look up instance metadata on CI runners | `AWS_EC2_METADATA_DISABLED=true`, no credentials in fixtures |
| Mayank | Package only `backend/` for Lambda | `CodeUri: ..` would copy the whole repo | `CodeUri: ../backend` + `BuildMethod: makefile`; one shared dependency layer |
| Mayank | Catch-all HTTP API route | YAML parse error on `Path: /{proxy+}` | Quoted the path |
| Mayank, Debadrita | Play a demo day at real times of day | `ring-sandbox play` back-dates events relative to "now" | A driver/runner that sets the time explicitly (`demo_driver.py`, `play_day.py`) |
| Mayank | `demo_run.sh --exit` left ports busy | Servers were still shutting down | `wait` on the PIDs in the cleanup trap |
| Mayank | Import `backend` in tests | `ModuleNotFoundError` (path contains spaces) | `pythonpath = ["."]` in the pytest config |
| Krishnaditya | Add `Routine.day_slots` | Broke the field-list contract test | Raised it as a request in the PR |
| Debadrita | Use indoor cameras in scenarios | `KeyError: no device named 'Kitchen Cam'` | Add missing cameras by name through `POST /_sandbox/devices` |
| Debadrita | Make scenario files work with the team's driver | The driver exits without `story_start` | Added `story_start` / `check_at` to every scenario |
| Debadrita | Run the backend on Windows | `ZoneInfoNotFoundError`; `DEMO_CLOCK_START=00:00` crashed at startup | Installed `tzdata`; passed a full ISO timestamp |
| Debadrita | Contribute scenarios upstream in a sub-folder | The example loader doesn't look in sub-folders | Put the files flat in `examples/` |
| Debadrita | Test the parent app with user-event and fake timers | Every click test timed out | Used `fireEvent` |
| Anushka | Film the mock dashboard at any hour | Mock data on the real clock: after midnight the day was empty ("No kitchen movement by 00:04") | Mock mode runs on a story clock (today 16:30 IST, or `?time=HH:MM`) |
| Anushka | Real-API demo while the backend runs a demo clock | Browser time 00:28 vs backend 17:05: "Last seen: just now" for 13:00 events | Follow `GET /_dev/clock` in real mode |
| Anushka | Hour labels on a 375 px phone | "00:0006:00" overlapped | Short labels below the `sm` breakpoint |
| Mayank | Weekly trend in the 21:00 digest on AWS | The digest Lambda had no read access to the routine table (would fail with AccessDenied; invisible locally) | Granted `BatchGetItem` on that table only; a trend failure no longer blocks the digest |
| Debadrita | Run the quick start on a fresh clone on Windows | `pip install` failed with `OSError` on a deep botocore data file (260-character path limit) | Cloned to a short path; enabling long paths also fixes it |

## Feature requests

| Tool | What | Why | Urgency |
|---|---|---|---|
| ring-sandbox | `play --start <ISO datetime>` (or absolute `at` per step), and `inject --at` | Care and routine apps need events at real times of day ("no kitchen motion by 10:20") | important |
| ring-sandbox | A documented mapping from webhook `type`/`sub_type` to history `event_type` | Every integrator has to normalize both shapes | important |
| ring-sandbox | A PyPI release matching `main` (416 on empty snapshot windows, offline 503 on media) | The README documents behaviour the wheel doesn't have | important |
| ring-sandbox | A `devices:` block in scenario YAML (or a `--world` preset) that creates indoor cameras | Elder-care scenarios aren't self-contained today | important |
| ring-sandbox | A friendly CLI error for an unknown `device:`; examples in sub-folders | Clearer errors; themed example sets | nice-to-have |
| AWS SAM | A `.samignore` (or `Exclude`) for the Python builder | Monorepos shouldn't need a Makefile just to skip folders | important |
| AWS Step Functions | An idempotent `SendTaskSuccess` (no error if the task already finished) | Ack and timeout naturally race in human-in-the-loop flows | nice-to-have |
| Amazon Polly | Mention `LanguageCode` for bilingual voices in the `synthesize_speech` examples | Easy to get the wrong pronunciation | nice-to-have |
| Amazon Bedrock | A strict-JSON output option in Converse without tool-use boilerplate | Structured outputs like visitor descriptions need validation code today | important |
| Python on Windows | Make `zoneinfo` errors point to the `tzdata` package | Cost two of us time | nice-to-have |
| React Router | Say in the v7 future-flag warning that test routers (`MemoryRouter`) need the flags too | Every test run was noisy | nice-to-have |
| npm | Say clearly whether skipping an install script (`allow-scripts`) breaks the package | The warning looks like an error to newcomers | nice-to-have |
