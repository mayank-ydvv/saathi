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

## Friction log
- Phase 1 started before the bootstrap PR (`models.py`) was merged → copied it verbatim from `mayank/bootstrap` as the build prompt says → adding `Routine.day_slots` breaks the field-list check in `tests/backend/test_models_contract.py` → raised as a request in the PR.
