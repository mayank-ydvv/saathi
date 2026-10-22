# Product feedback: Mayank (backend, AWS, integration)

Notes written as we build, not at the end. One section per tool, then the friction log and feature requests.

## Tools

### ring-sandbox (PyPI `ring-sandbox` 0.5.0)
- **Used for:** the `RingClient` typed client, webhook HMAC helpers, and the offline Ring Partner API emulator we develop and demo against.
- **Worked well:** the README is unusually complete (fidelity table, webhook signing, CLI). `webhooks.verify()` / `webhooks.parse()` handle the raw-body HMAC correctly, so we don't hand-roll crypto. Plain `http://` is allowed only for localhost, a sensible guard.
- **Needs work:** webhook types (`motion_detected` + `sub_type=human`, `button_press`) differ from the history types (`motion`, `ding`), and the mapping between the two isn't written down in one place; we built our own normalization table. The default world has no indoor cameras (only Front Door, Backyard, a chime and a contact sensor), so elder-care setups need extra `POST /_sandbox/devices` calls.
- **Onboarding:** install to first `ring-sandbox --help` in about 2 minutes.
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

## Friction log

| Task attempted | Steps taken | Where it broke | How we fixed it |
|---|---|---|---|
| Keep the contract doc verbatim and pass `ruff format --check` | Copied section 4 into `docs/CONTRACTS.md` | ruff reformatted the Python snippets inside the Markdown | Excluded `*.md` from `ruff format` |
| Import `backend` in tests | Editable install with uv | `ModuleNotFoundError: backend` under pytest (project path contains spaces) | `pythonpath = ["."]` in the pytest config |

## Feature requests

| What | Why | Urgency |
|---|---|---|
| ring-sandbox: a documented table mapping webhook `type`/`sub_type` to history `event_type` | Every integrator has to normalize both shapes | important |
| ring-sandbox: an `--world` preset or YAML for custom device sets (indoor cameras) | Elder-care and home-monitoring use cases need indoor zones | nice-to-have |
