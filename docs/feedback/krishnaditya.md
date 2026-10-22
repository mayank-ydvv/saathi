# Product feedback — Krishnaditya

## Python standard library (`zoneinfo`, `statistics`, `dataclasses`)
- **Used for:** routine learning in `backend/engine/routine.py` (local-time slots, median/MAD of first activity).
- **Worked well:** `zoneinfo` + `astimezone` made the Asia/Kolkata midnight boundary trivial; `dataclass(slots=True)` with `field(default_factory=...)` let us add a field without breaking positional constructors.
- **Needs work:** `zoneinfo` silently depends on the `tzdata` package on Windows; nothing in the error points you there.
- **Onboarding:** minutes.
- **Again?** Yes — no dependencies for the engine core.

## pytest / ruff
- **Used for:** engine unit tests and lint/format.
- **Worked well:** fast, zero-config with the repo `pyproject.toml`.
- **Again?** Yes.

## Amazon Bedrock (Converse API via boto3)
- **Used for:** evening digest text and doorbell visitor description (`backend/digest/`).
- **Worked well:** one request shape for text and images across models; `system`, `messages`, `inferenceConfig` are clear. The botocore service model (`get_service_model("bedrock-runtime")`) let us verify every field name offline before writing code.
- **Needs work:** no way to request strict JSON output without tool-use boilerplate, so we validate and fall back ourselves. Timeouts/retries live in botocore `Config`, not in the Converse docs page, so they're easy to miss.
- **Onboarding:** request shape in minutes; live calls still pending AWS credentials and model access.
- **Again?** Yes — model-agnostic API, easy to mock in tests.

## Friction log
- Phase 1 started before the bootstrap PR (`models.py`) was merged → copied it verbatim from `mayank/bootstrap` as the build prompt says → adding `Routine.day_slots` breaks the field-list check in `tests/backend/test_models_contract.py` → raised as a request in the PR.
