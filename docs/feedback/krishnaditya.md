# Product feedback: Krishnaditya (engine, digest, fixtures, routine-guard)

Notes written as we build. One section per tool, then the friction log and feature requests.

## Tools

### ring-sandbox (PyPI `ring-sandbox` 0.5.0)
- **Used for:** the end-to-end audit of the engine: ran the emulator (`:8787`) with our API, replayed every demo scenario (normal day, fall, night door, scam visitor, plus the six team scenarios) and checked each raised exactly the expected alerts. The fixtures in `sandbox/fixtures/` follow its history event shape (`motion` / `ding`, `sub_type=human`).
- **Worked well:** the emulator starts in seconds and needs no account or hardware, so we could debug the engine against realistic event flow. That's how we found a real false-alarm bug (late_start firing for the front door and living room and burying the kitchen alert), fixed in PR #15.
- **Needs work:** the doorbell snapshot becomes available a few seconds after the `ding` event, and nothing in the docs says so; a visitor-description step that fetches immediately gets nothing. Event timestamps follow the real clock, so a test that needs "10:20 in the morning" has to bring its own clock offset.
- **Onboarding:** running the full stack locally took about 15 minutes, most of it Windows issues (see the friction log).
- **Build with it again?** Yes.

### Amazon Bedrock (Converse API via boto3)
- **Used for:** evening digest text and doorbell visitor description (`backend/digest/`).
- **Worked well:** one request shape for text and images across models; `system`, `messages`, `inferenceConfig` are clear. The botocore service model (`get_service_model("bedrock-runtime")`) let us verify every field name offline before writing code.
- **Needs work:** no way to request strict JSON output without tool-use boilerplate, so we validate and fall back ourselves. Timeouts and retries live in botocore `Config`, not on the Converse docs page, so they're easy to miss.
- **Onboarding:** request shape in minutes; live calls still pending AWS credentials and model access.
- **Build with it again?** Yes. The API doesn't depend on the model and is easy to mock in tests.

### boto3 / botocore
- **Used for:** the Bedrock client (`connect_timeout`/`read_timeout` 20 s, `max_attempts` 2).
- **Worked well:** the service model ships in the wheel, so request and response shapes can be inspected without credentials.
- **Needs work:** building a client at import time makes every test and fallback path depend on AWS config; we build it lazily on first call (region defaults to `us-east-1`) so the deterministic fallback runs with no AWS setup.
- **Build with it again?** Yes.

### Python standard library (`zoneinfo`, `statistics`, `dataclasses`)
- **Used for:** routine learning in `backend/engine/routine.py` (local-time slots, median/MAD of first activity).
- **Worked well:** `zoneinfo` + `astimezone` made the Asia/Kolkata midnight boundary trivial; `dataclass(slots=True)` with `field(default_factory=...)` let us add a field without breaking positional constructors.
- **Needs work:** `zoneinfo` silently depends on the `tzdata` package on Windows; nothing in the error points you there.
- **Onboarding:** minutes.
- **Build with it again?** Yes. The engine core has no dependencies.

### pytest / ruff
- **Used for:** 51 engine and digest tests, lint and format.
- **Worked well:** fast and zero-config with the repo `pyproject.toml`; the README example in routine-guard is executed as a test so it can't go stale.
- **Build with it again?** Yes.

### GitHub Actions
- **Used for:** CI on the team repo and on [routine-guard](https://github.com/krishnadityasingh18-create/routine-guard) (Python 3.11 / 3.12 / 3.13 matrix: ruff then pytest).
- **Worked well:** `setup-python` with a version matrix is a few lines; results show up on the PR.
- **Needs work:** one matrix job (3.12) sat queued for a long time with no indication why, and a cancel request didn't take effect before it ran and passed.
- **Build with it again?** Yes.

### setuptools / pip (packaging routine-guard)
- **Used for:** publishing the engine as a standalone MIT package (`src/` layout, `pyproject.toml`, `pip install git+https://...`).
- **Worked well:** `pyproject.toml` with `setuptools.build_meta` needs no `setup.py`; installing straight from GitHub works without a PyPI release.
- **Needs work:** on Windows, pip installs console scripts to a user `Scripts` folder that isn't on `PATH`, only a warning tells you.
- **Build with it again?** Yes.

## Friction log

| Task attempted | Steps taken | Where it broke | How we fixed it |
|---|---|---|---|
| Start Phase 1 before the bootstrap PR merged | Copied `models.py` verbatim from `mayank/bootstrap`, as the build prompt says | Adding `Routine.day_slots` broke the field-list check in `tests/backend/test_models_contract.py` | Raised in the PR; the contract test was updated |
| Run the engine on Windows | `ZoneInfo("Asia/Kolkata")` | `ZoneInfoNotFoundError`; Windows has no system tz database | `pip install tzdata` |
| Run the backend tests on Windows | `pip install moto` | Install failed on a path longer than 260 characters | Skipped `test_store.py` locally; CI on Linux covers it |
| Run `scripts/demo_run.sh` on Windows (Git Bash) | Started the demo | Its port check uses `lsof`, which doesn't exist on Windows, so a stale server on `:8000` answered instead | Killed the processes on the port from PowerShell before each run |
| Print engine output on Windows | `print()` with `—` in an alert reason | `UnicodeEncodeError` on the cp1252 console | `sys.stdout.reconfigure(encoding="utf-8")` |
| Seed routines, then set the demo clock | Seeded, then `POST /_dev/clock` | The scheduler ticked on the real clock in between and acted on a "day" the scenario never meant | Set the clock before seeding; reported to the harness owner |
| Audit a normal day | Replayed `normal_day` through the engine | late_start fired for the front door and living room, which have no "usual first time" that means anything | Limited late_start to kitchen and bedroom, with a failing test first (PR #15) |

## Feature requests

| What | Why | Urgency |
|---|---|---|
| Bedrock Converse: a native "respond with JSON matching this schema" option | Every structured-output caller writes validation and fallback code, or tool-use boilerplate | important |
| Bedrock docs: show timeout and retry `Config` on the Converse page | A hung model call blocks a request; the knobs are only in botocore docs | nice-to-have |
| ring-sandbox: document (or emit an event) when a doorbell snapshot becomes available | Anything that describes the visitor races the snapshot | important |
| Python on Windows: a hint in `ZoneInfoNotFoundError` to install `tzdata` | Every Windows developer hits this once with no clue in the error | nice-to-have |
| GitHub Actions: show why a job is queued | A stuck matrix job is indistinguishable from a slow one | nice-to-have |
