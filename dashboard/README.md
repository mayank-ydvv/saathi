# Saathi family dashboard

The web app a son or daughter opens to see whether their parent is okay today: status, the
day's timeline, alerts and how they were resolved, the evening digest, and the usual routine.

| Page | What it shows |
|---|---|
| **Today** | A status card in the status colour with the parent's photo, the open alert and **I'm checking** inside it, four stat cards, a room-coloured timeline (hover a mark for a tooltip), the latest events and today's doorbell rings |
| **Alerts** | Totals, open count and average response time; All / Open / Resolved filters; alerts grouped by day with the escalation steps left to right |
| **Visitors** | Every doorbell ring and parcel for a chosen day, with the snapshot and description; strangers are flagged |
| **Digest** | The evening digest as a letter, with **Listen** (the browser reads it aloud) and **Copy**, and the last seven days to jump between |
| **Routine** | Plain-language highlights (usually up by, busiest hour, most-used room), a rooms × hours heatmap and each room's 24-hour chart |
| **Family** | Who each step of the ladder reaches, by name, and the name sent with "I'm checking" |

Every page ends in a short, collapsible "What does this mean?" note. While an alert is open, phones
keep an **I'm checking** bar pinned above the tabs, and a toast confirms the acknowledgement.
When the home has the parent's number (`PARENT_PHONE` when seeding, see docs/BACKEND.md), a
**Call** button appears on the status card, in the sidebar and on the Family page.

React 18 + Vite + TypeScript (strict) + Tailwind CSS 4 + React Router, tested with Vitest.
The look is the landing page's warm almanac palette with real hierarchy: Fraunces for headings,
Alegreya Sans for text, soft shadows on cards, and one colour per room.
Times use `Intl` in Asia/Kolkata. The per-room routine bars are plain SVG; the stat cards and the
"typical day" chart use Recharts through a trimmed shadcn/ui chart wrapper, and the animations
are Magic UI / Aceternity components ported into `src/components/ui/` (each file names its source).

## Family login

Everything except the login screens sits behind a login. Family members sign up with their name,
email and a password (8+ characters with a lowercase letter and a number), type the 6-digit
code from the verification email, and then log in. "Forgot password?" emails a reset code. The
logged-in name is the one sent with "I'm checking", and the session survives a refresh (tokens
are renewed with the refresh token).

| Variable | Default | Meaning |
|---|---|---|
| `VITE_COGNITO_REGION` | empty | AWS region of the user pool (stack output `CognitoRegion`) |
| `VITE_COGNITO_CLIENT_ID` | empty | App client id (stack output `FamilyUserPoolClientId`) |

With both set, the screens call **Amazon Cognito** directly (`src/auth/cognito.ts`), and Cognito
sends the verification and reset emails. With them empty you get **demo sign-in**: accounts live
in this browser's localStorage, the code is shown on screen instead of emailed, and the login
card says so.

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
