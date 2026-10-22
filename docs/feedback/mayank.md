# Product feedback: Mayank (backend, AWS, integration)

Notes written as we build, not at the end. One section per tool, then the friction log and feature requests.

## Tools

### ring-sandbox (PyPI `ring-sandbox` 0.5.0)
- **Used for:** the `RingClient` typed client, webhook HMAC helpers, and the offline Ring Partner API emulator we develop and demo against.
- **Worked well:** the README is unusually complete (fidelity table, webhook signing, CLI). `webhooks.verify()` / `webhooks.parse()` handle the raw-body HMAC correctly, so we don't hand-roll crypto. Plain `http://` is allowed only for localhost, a sensible guard.
- **Needs work:** webhook types (`motion_detected` + `sub_type=human`, `button_press`) differ from the history types (`motion`, `ding`), and the mapping between the two isn't written down in one place; we built our own normalization table. The default world has no indoor cameras (only Front Door, Backyard, a chime and a contact sensor), so elder-care setups need extra `POST /_sandbox/devices` calls.
- **Also confusing:** the published 0.5.0 wheel doesn't match the GitHub `main` README. On the wheel, a `latest_in_range` snapshot over a window with no recording still returns a frame (from the window end) instead of `416 TIMESTAMP_NOT_FOUND`, and offline devices aren't rejected on media. We only found out by reading the installed `emulator.py`. The placeholder snapshot is a PNG even when `format=jpeg` is requested.
- **Pleasant surprise:** the bundled pytest plugin (`ring_transport`, `ring_control` fixtures) runs the emulator in-process, so our ingest tests make real `RingClient` calls with no sockets.
- **Onboarding:** install to first `ring-sandbox --help` in about 2 minutes; first in-process `RingClient` test in about 15 minutes.
- **Build with it again?** Yes. It's the only way to test a Ring partner integration without hardware.

### uv
- **Used for:** creating the Python 3.11 virtualenv and installing dependencies.
- **Worked well:** resolved and installed the full FastAPI/boto3/moto stack in seconds.
- **Needs work:** nothing so far.
- **Onboarding:** instant.
- **Build with it again?** Yes.

### ruff
- **Used for:** linting and formatting (line length 100).
- **Worked well:** fast, one tool for lint and format.
- **Needs work:** `ruff format --check .` also formats Python blocks inside Markdown files, so our verbatim contract doc (`docs/CONTRACTS.md`) failed CI. Fixed with `[tool.ruff.format] exclude = ["*.md"]`. The behaviour surprised us; the error points at the `.md` file but doesn't say why Markdown is in scope.
- **Onboarding:** minutes.
- **Build with it again?** Yes.

### Amazon Polly
- **Used for:** the spoken nudge on the parent app ("Good morning Kamala, are you okay? ...").
- **Worked well:** the "Available voices" table is clear about engines per voice; `Kajal` gives a natural neural en-IN voice.
- **Needs work:** bilingual voices (Kajal, Aditi) need `LanguageCode` or they may read English text with the other language's rules. The table marks them with an asterisk, but `synthesize_speech` examples don't mention it. Region availability for neural voices is on a separate page.
- **Onboarding:** reading the docs to a working call shape took about 10 minutes; we cache MP3s by text hash so each phrase is synthesized once.
- **Build with it again?** Yes.

### Telegram Bot API
- **Used for:** family/neighbour alerts with an inline "I'm checking" button; a button press acks the alert.
- **Worked well:** plain HTTPS JSON; long polling (`getUpdates` with `timeout`) delivers button presses in about a second without a public URL, which suits local development.
- **Needs work:** `callback_data` is limited to 64 bytes, so we keep it to `ack:<alert_id>:<audience>`. You must `answerCallbackQuery` or the button spins on the user's phone.
- **Onboarding:** BotFather to first message in minutes.
- **Build with it again?** Yes, free and instant for demos.

### AWS Step Functions
- **Used for:** the escalation ladder on AWS: one execution per alert, `waitForTaskToken` Tasks with timeouts, `SendTaskSuccess` on ack.
- **Worked well:** the callback-token pattern maps one-to-one onto "wait N minutes unless someone acknowledges". `TimeoutSecondsPath` lets the demo pass 10–20 s waits per execution without a second state machine.
- **Needs work:** a late `SendTaskSuccess` for a token whose Task already timed out raises `TaskTimedOut`. That's expected, but every caller has to catch it. It would help to have an idempotent "ignore if finished" option.
- **Onboarding:** designing the ASL took about 30 minutes; local testing needs fakes (no local runtime in our setup).
- **Build with it again?** Yes.

### AWS SAM CLI (1.169)
- **Used for:** the whole AWS stack (tables, bucket, HTTP API, Lambdas, schedules, state machine) and `sam build` packaging.
- **Worked well:** `sam validate --lint` (cfn-lint built in) works offline with no credentials. `DefinitionSubstitutions` keeps the state machine as a plain, testable JSON file.
- **Needs work:** there's no ignore file for the Python builder, so a function's `CodeUri` either includes the whole repo (frontends, `.venv`) or you switch to `BuildMethod: makefile`. We had to read `aws_lambda_builders/workflows/custom_make` to learn that `CodeUri` is copied to a scratch dir and the Makefile comes from `ContextPath`. An unquoted `Path: /{proxy+}` inside a YAML flow mapping fails with a parser error ("expected ',' or '}'") that doesn't hint at quoting.
- **Onboarding:** install to first successful `sam build` in about 20 minutes, most of it figuring out packaging.
- **Build with it again?** Yes, but we'd start from the makefile builder.

## Friction log

| Task attempted | Steps taken | Where it broke | How we fixed it |
|---|---|---|---|
| Keep the contract doc verbatim and pass `ruff format --check` | Copied section 4 into `docs/CONTRACTS.md` | ruff reformatted the Python snippets inside the Markdown | Excluded `*.md` from `ruff format` |
| Test "no snapshot when nothing was recorded" | Followed the README fidelity table (416 when nothing recorded) | Installed 0.5.0 wheel returned a frame anyway | Read the installed `emulator.py`; simulated the 416 in our unit test |
| Store doorbell snapshots as JPEG | Requested `format=jpeg` | Emulator placeholder is a PNG | Detect the image type from magic bytes before saving |
| Name a pydantic field `date` next to `from datetime import date` | `date: date | None` in a request model | `TypeError: unsupported operand type(s) for |: 'NoneType' and 'NoneType'` at import | Renamed the field to `day` |
| Keep tests from touching real AWS | Polly client built lazily | boto3 can look up instance metadata on CI runners | `AWS_EC2_METADATA_DISABLED=true` and no credentials in the test fixtures |
| Package only `backend/` for Lambda | `CodeUri: ..` with the Python builder | Would copy the whole repo including `.venv` and frontends | `CodeUri: ../backend` + `BuildMethod: makefile` + `ContextPath: .`; one shared dependency layer of manylinux wheels |
| Catch-all HTTP API route | `Path: /{proxy+}` in a `{ ... }` flow mapping | YAML parse error | Quote the path: `Path: "/{proxy+}"` |
| Import `backend` in tests | Editable install with uv | `ModuleNotFoundError: backend` under pytest (project path contains spaces) | `pythonpath = ["."]` in the pytest config |

## Feature requests

| What | Why | Urgency |
|---|---|---|
| ring-sandbox: a documented table mapping webhook `type`/`sub_type` to history `event_type` | Every integrator has to normalize both shapes | important |
| ring-sandbox: publish a release matching `main` (416 on empty snapshot windows, offline 503 on media) | The README documents behaviour the PyPI wheel doesn't have yet | important |
| Step Functions: an idempotent SendTaskSuccess (no error when the task already finished) | Ack and timeout naturally race in human-in-the-loop flows | nice-to-have |
| SAM: a `.samignore` (or `Exclude`) for the Python builder | Monorepos shouldn't need a Makefile just to skip folders | important |
| ring-sandbox: an `--world` preset or YAML for custom device sets (indoor cameras) | Elder-care and home-monitoring use cases need indoor zones | nice-to-have |
