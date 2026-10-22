# Saathi family dashboard

The web app a son or daughter opens to see whether their parent is okay today: status, the
day's timeline, alerts and how they were resolved, the evening digest, and the usual routine.

React 18 + Vite + TypeScript (strict) + Tailwind CSS 4 + React Router, tested with Vitest.
No chart, date or state libraries: charts are plain SVG, times use `Intl` in Asia/Kolkata.

## Run it

```bash
cd dashboard
npm install
npm run dev          # http://localhost:5173 (the port the backend's CORS allows)
npm run test         # Vitest
npm run lint         # ESLint
npm run build        # type-check + production build
```

## Mock data or the real API

Settings come from `VITE_*` variables (copy `.env.example` to `.env`):

| Variable | Default | Meaning |
|---|---|---|
| `VITE_USE_MOCK` | `true` | `true`: answer from `src/mocks/`, no backend needed. `false`: call the API |
| `VITE_API_BASE` | `http://localhost:8000` | Saathi API base URL |
| `VITE_HOME_ID` | `home-demo-1` | Which home to show |

With the real API: start the backend (`uvicorn backend.api.main:app --port 8000` from the
repo root, or `scripts/demo_run.sh fall_day`), then `VITE_USE_MOCK=false npm run dev`.

**Demo clock.** Scenarios move the backend's clock (e.g. `fall_day` checks at 17:05 IST). When
the backend runs with `DEMO_MODE=true` it serves `GET /_dev/clock`, and the dashboard follows that
time (re-synced every 10 s) so the header clock, the timeline's now-line and "Last seen … ago"
agree with the alerts. Without that endpoint (production) it uses the device's time.

Status and alerts refresh every 5 s and the timeline every 30 s, only while the tab is visible.

### Mock mode for filming

The mock day is Kamala's in Chennai: 61 events over four zones, two doorbell visitors (one
flagged), a resolved late start with every escalation step, and an open alert.

In mock mode the top bar has a **Demo** switch (**Normal · Checking · Alert**) that changes the
status on the spot for filming; it writes the choice to the URL (`?mock=…`), so the same state
can be reopened or shared. The switch is hidden when `VITE_USE_MOCK=false`.

| URL | Shows |
|---|---|
| `/?mock=green` | All normal |
| `/?mock=yellow` | Checking in (alert in NUDGE_PARENT) |
| `/?mock=red` (default) | Needs attention (alert in ALERT_FAMILY) |
| `/?time=21:30` | Any `HH:MM`: the mock clock starts there (default 16:30) — e.g. after 21:00 today's digest exists |

Both parameters combine, e.g. `/?mock=green&time=21:30`. Pressing **I'm checking** in mock
mode resolves the alert and the status turns green, like the real backend.

## Screenshots

Mock data, light, laptop (1024 px): [Today · red](docs/screenshots/today-red-laptop.jpg) ·
[Today · yellow](docs/screenshots/today-yellow-laptop.jpg) · [Today · green](docs/screenshots/today-green-laptop.jpg) ·
[Alerts](docs/screenshots/alerts-laptop.jpg) · [Digest](docs/screenshots/digest-laptop.jpg) ·
[Routine](docs/screenshots/routine-laptop.jpg)

Phone (375 px): [Today · red](docs/screenshots/today-red-phone.jpg) ·
[Caution visitor](docs/screenshots/visitor-caution-phone.jpg) · dark: [Today · red](docs/screenshots/today-red-phone-dark.jpg),
[Routine](docs/screenshots/routine-phone-dark.jpg), [Demo switch](docs/screenshots/demo-switch-phone-dark.jpg)

Real backend (`fall_day`, dark): [yellow](docs/screenshots/real-api-yellow-dark.jpg) →
[red](docs/screenshots/real-api-red-dark.jpg) → [after I'm checking](docs/screenshots/real-api-after-ack-dark.jpg) ·
[Alerts](docs/screenshots/real-api-alerts-dark.jpg)
