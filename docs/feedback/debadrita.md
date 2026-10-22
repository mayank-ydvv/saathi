# Product feedback: Debadrita (scenarios, parent app, docs, video)

Notes written as we build, not at the end. One section per tool, then the friction log and feature requests.

## Tools

### ring-sandbox (PyPI `ring-sandbox` 0.5.0)
- **Used for:** scripting six "days in the life" of a parent as YAML scenarios. We play them through the emulator with `ring_sandbox.scenarios.load_yaml` / `run(start=...)`, plus `POST /_sandbox/devices` to add indoor cameras.
- **Worked well:** the scenario schema is tiny and documented at the top of every shipped example (`offset_s`, `type`, `sub_type`, `device`, `duration_ms`), so writing new scenarios took minutes. `run()` takes a `start` datetime, which let us pin events to real clock times without touching the library. Webhooks arrived HMAC-signed and verified with `webhooks.verify()` on the first try (168/168 valid in our test run). Device ids are free-form.
- **Needs work:** `ring-sandbox play` has no `--start`/`--at` flag; a scenario always ends "now", so there is no way from the CLI to say "this happens at 06:50". `ring-sandbox inject` also has no `--at`, although `POST /_sandbox/events` accepts `at`. The default world has no indoor cameras, and an unknown `device:` name in a scenario surfaces as a raw `KeyError` traceback rather than a CLI error. The prompt we started from expected `delivery` / `home_aide_visit` as YAML examples; they are actually built into `scenarios.py`, while the wheel's `examples/` folder holds `late_arrival`, `partial_blackout`, `subscription_lapse` and `visitor_not_worker`.
- **Onboarding:** install to first played scenario in about 10 minutes, mostly reading `scenarios.py` and `cli.py` to learn the limits above.
- **Build with it again?** Yes. Without it we could not demo a Ring integration with no hardware, and the source is small and readable enough to answer every question.

### ruff / pytest
- **Used for:** formatting and linting the scenario runner, and testing that every scenario loads with ring-sandbox's own parser.
- **Worked well:** one command each, fast.
- **Needs work:** nothing so far.
- **Onboarding:** minutes.
- **Build with it again?** Yes.

### ring-sandbox (as an open-source contributor)
- **Used for:** our Open Source entry, a pull request adding three elder-care example scenarios to the project.
- **Worked well:** CONTRIBUTING.md names scenario files as one of the most valuable contributions and gives the exact dev commands. Examples ship inside the wheel and two existing tests cover every file in `examples/` automatically, so adding a scenario needed no test changes. The full suite (92 tests) ran green locally on Windows in about a minute.
- **Needs work:** the example loader only reads the top level of `examples/`, so a sub-folder such as `examples/elder_care/` would not resolve by name. Nothing says so; we found it in `scenarios.py`. The README still says "Three documented examples" although four shipped before our change.
- **Onboarding:** clone to green test suite in about 5 minutes.
- **Build with it again?** Yes.

### Saathi backend demo tooling (our own `demo_driver.py`, `seed_home`)
- **Used for:** verifying each scenario against the real engine on the demo clock.
- **Worked well:** one driver plays any scenario file; the `/_dev/clock` and `/_dev/tick` routes make a whole day testable in about two minutes.
- **Needs work:** `DEMO_CLOCK_START` wants a full ISO timestamp (`HH:MM` crashes the API at startup), and on Windows the backend needs the `tzdata` package for `ZoneInfo`.

### Vite 6, React 18, Tailwind CSS 4, Vitest
- **Used for:** the parent app (`parent-app/`).
- **Worked well:** Tailwind 4's Vite plugin needs no PostCSS or config file, and `@theme` CSS variables kept a small, high-contrast palette consistent. Vitest with jsdom and fake timers tested 3 s polling and the 5 s thank-you screen without real waiting.
- **Needs work:** `@testing-library/user-event` v14 hangs under Vitest fake timers even with `delay: null`; we switched to `fireEvent`. Vite 7 requires Node 20.19 or newer, so we stayed on Vite 6.
- **Onboarding:** about 15 minutes to a running app.
- **Build with it again?** Yes.

### Excalidraw
- **Used for:** the architecture diagram (`docs/architecture.excalidraw`, exported as `docs/architecture.png`).
- **Worked well:** the `.excalidraw` file is plain JSON, so the diagram can be generated and reviewed like code, and the current release renders it as written.
- **Needs work:** the older `@excalidraw/utils` 0.1.2 package ignores `lineHeight` and `roundness`, so two-line labels overlap and straight arrows curve. Easy to mistake for a broken file.
- **Build with it again?** Yes.

## Friction log

| Task attempted | Steps taken | Where it broke | How we fixed it |
|---|---|---|---|
| Play a scenario at real times of day (06:50 wake-up) | `ring-sandbox play normal_day.yml --speed 600` | Events landed relative to "now" (e.g. 20:11), not 06:50; `play` has no start-time option | Small runner `play_day.py` calling `run(..., start=local_midnight)`; `offset_s` = seconds after local midnight |
| Use kitchen / living room / bedroom cameras | Named them in `device:` | `KeyError: no device named/id 'Kitchen Cam' in sandbox world` | Runner adds missing ones by name via `POST /_sandbox/devices` (same names the backend's seeding uses) |
| Use Asia/Kolkata on Windows | `ZoneInfo("Asia/Kolkata")` | No IANA tz database on Windows without the `tzdata` package | Fixed UTC+05:30 offset (India has no DST, so it is exact) |
| Check the scenarios trigger only their intended anomaly | Simulated the contract's rules over 14 learned days | Rare-slot rule also fires on daytime visitors; inactivity counts overnight sleep | Raised with the engine owner; the merged engine already limits the night rule to non-waking hours and counts the night only from 06:00 |
| Make our scenario files work with the team's demo driver | Ran `scripts/demo_driver.py sandbox/scenarios/fall_day.yml` | Driver exits without a `story_start` key; my runner would also have deleted the cameras `seed_home` created | Added `story_start: "00:00"` / `check_at`; runner now only adds missing devices by name |
| Verify scenarios end to end on Windows | Started the API with `DEMO_CLOCK_START=00:00` | `ValueError: Invalid isoformat string: '00:00'` at startup; later `ZoneInfoNotFoundError` in tests | Passed a full ISO timestamp; installed `tzdata` in the local venv |
| Contribute scenarios upstream in a sub-folder | Planned `examples/elder_care/*.yml` | `scenarios.examples()` doesn't recurse, so names wouldn't resolve | Put the files flat in `examples/` like the existing ones |
| Test the parent app with user-event and fake timers | `userEvent.setup({ advanceTimers })`, then `{ delay: null }` | Every click test timed out after 5 s | Used `fireEvent` inside `act` |
| Run the quick start on a fresh clone on Windows | `pip install -e ".[dev]"` in a deep folder | `OSError: No such file or directory` on a botocore data file (Windows 260-character path limit) | Cloned to a short path; enabling long paths also fixes it |

## Feature requests

| What | Why | Urgency |
|---|---|---|
| ring-sandbox: `play --start <ISO datetime>` (or `--at-time HH:MM`) | Routine/care apps need events at real times of day; today you must drop to the Python API | important |
| ring-sandbox: `inject --at <ISO datetime>` | The endpoint already supports `at`; the CLI doesn't expose it | nice-to-have |
| ring-sandbox: a `devices:` block in scenario YAML that creates missing devices | Scenarios that use their own devices are not self-contained today | important |
| ring-sandbox: friendly CLI error for an unknown `device:` name | Currently a raw `KeyError` traceback | nice-to-have |
| ring-sandbox: let `examples()` / `resolve()` find scenarios in sub-folders of `examples/` | Lets themed sets (e.g. elder care) live together without name clashes | nice-to-have |
| Saathi: accept `HH:MM` for `DEMO_CLOCK_START` and add `tzdata` for Windows developers | Both broke a first local run | nice-to-have |
