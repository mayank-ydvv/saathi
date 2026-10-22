# Product feedback: Debadrita (scenarios, parent app, docs, video)

Notes written as we build, not at the end. One section per tool, then the friction log and feature requests.

## Tools

### ring-sandbox (PyPI `ring-sandbox` 0.5.0)
- **Used for:** scripting six "days in the life" of a parent as YAML scenarios. We play them through the emulator with `ring_sandbox.scenarios.load_yaml` / `run(start=...)`, plus `POST /_sandbox/devices` to add indoor cameras.
- **Worked well:** the scenario schema is tiny and documented at the top of every shipped example (`offset_s`, `type`, `sub_type`, `device`, `duration_ms`), so writing new scenarios took minutes. `run()` takes a `start` datetime, which let us pin events to real clock times without touching the library. Webhooks arrived HMAC-signed and verified with `webhooks.verify()` on the first try (168/168 valid in our test run). Device ids are free-form, so we could use readable stable ids like `dev_kitchen_cam`.
- **Needs work:** `ring-sandbox play` has no `--start`/`--at` flag; a scenario always ends "now", so there is no way from the CLI to say "this happens at 06:50". `ring-sandbox inject` also has no `--at`, although `POST /_sandbox/events` accepts `at`. The default world has no indoor cameras, and an unknown `device:` name in a scenario surfaces as a raw `KeyError` traceback rather than a CLI error. The prompt we started from expected `delivery` / `home_aide_visit` as YAML examples; they are actually built into `scenarios.py`, while the wheel's `examples/` folder holds `late_arrival`, `partial_blackout`, `subscription_lapse` and `visitor_not_worker`.
- **Onboarding:** install to first played scenario in about 10 minutes, mostly reading `scenarios.py` and `cli.py` to learn the limits above.
- **Build with it again?** Yes. Without it we could not demo a Ring integration with no hardware, and the source is small and readable enough to answer every question.

### ruff / pytest
- **Used for:** formatting and linting the scenario runner, and testing that every scenario loads with ring-sandbox's own parser.
- **Worked well:** one command each, fast.
- **Needs work:** nothing so far.
- **Onboarding:** minutes.
- **Build with it again?** Yes.

## Friction log

| Task attempted | Steps taken | Where it broke | How we fixed it |
|---|---|---|---|
| Play a scenario at real times of day (06:50 wake-up) | `ring-sandbox play normal_day.yml --speed 600` | Events landed relative to "now" (e.g. 20:11), not 06:50; `play` has no start-time option | Small runner `play_day.py` calling `run(..., start=local_midnight)`; `offset_s` = seconds after local midnight |
| Use kitchen / living room / bedroom cameras | Named them in `device:` | `KeyError: no device named/id 'Kitchen Cam' in sandbox world` | Runner creates them via `POST /_sandbox/devices` with stable ids before playing |
| Use Asia/Kolkata on Windows | `ZoneInfo("Asia/Kolkata")` | No IANA tz database on Windows without the `tzdata` package | Fixed UTC+05:30 offset (India has no DST, so it is exact) |
| Check the scenarios trigger only their intended anomaly | Simulated the contract's rules over 14 learned days | Rare-slot rule also fires on daytime visitors; inactivity counts overnight sleep | Raised with the engine owner instead of bending the scenarios |

## Feature requests

| What | Why | Urgency |
|---|---|---|
| ring-sandbox: `play --start <ISO datetime>` (or `--at-time HH:MM`) | Routine/care apps need events at real times of day; today you must drop to the Python API | important |
| ring-sandbox: `inject --at <ISO datetime>` | The endpoint already supports `at`; the CLI doesn't expose it | nice-to-have |
| ring-sandbox: a `devices:` block in scenario YAML that creates missing devices | Scenarios that use their own devices are not self-contained today | important |
| ring-sandbox: friendly CLI error for an unknown `device:` name | Currently a raw `KeyError` traceback | nice-to-have |
