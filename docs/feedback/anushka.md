# Product feedback: Anushka (family dashboard, frontend, design)

Notes written as we build, not at the end. One section per tool, then the friction log and feature requests.

## Tools

### Vite (v6.0)
- **Used for:** bundling, dev server (port 5173 with strictPort), and asset transformation for the Saathi family dashboard.
- **Worked well:** Instant dev server startup (<200ms) and lightning-fast HMR during component design. Strict port binding matches our CORS contract (`http://localhost:5173`) cleanly.
- **Needs work:** When resolving TypeScript project references (`tsconfig.app.json` and `tsconfig.node.json`), Vite's build passes through `tsc -b`, but standard dev mode skips type checking. Also, error overlays for JSX syntax errors in `.ts` files (instead of `.tsx`) can be cryptic ("Expected '>' but found 'status'").
- **Onboarding:** Under 3 minutes to a working React 18 + Vite development environment.
- **Build with it again?** Yes. It remains the gold standard for React Single Page Apps.

### Tailwind CSS (v4.0 with `@tailwindcss/vite`)
- **Used for:** styling the family dashboard with a calm, healthcare-grade aesthetic, WCAG AAA contrast ratios (≥7:1 for key status elements), and system dark mode.
- **Worked well:** Zero-config CSS import (`@import "tailwindcss";`) with no `tailwind.config.js` or PostCSS config required. The `@theme` directive allows declaring semantic variables (`--color-canvas`, `--color-status-green-bg`, etc.) directly in CSS.
- **Needs work:** `@theme` custom variables in v4 behave differently from v3's theme extension. Utilities like `focus:outline-hidden` have changed syntax from v3 (`outline-none`), causing subtle migration issues if relying on older v3 muscle memory. Documentation on how `@theme` interacts with `prefers-color-scheme` media queries is sparse; we had to map CSS variables under `@media (prefers-color-scheme: dark)` manually.
- **Onboarding:** About 10 minutes to understand Tailwind v4's CSS-first theming model.
- **Build with it again?** Yes. Extremely fast build times and zero configuration overhead.

### Vitest (v3.0)
- **Used for:** unit testing timezone math (`Asia/Kolkata`), relative time calculations, $O(n)$ timeline grouping, and mock client endpoints.
- **Worked well:** Shares the exact same Vite configuration and plugins, eliminating Babel/Jest transform drift. Test execution for 22 tests across 4 test suites finished in under 2 seconds. In-memory DOM testing via `jsdom` worked flawlessly.
- **Needs work:** `@testing-library/jest-dom/vitest` requires explicit import in setup files. When testing React 18 components, React 18's automatic batching can occasionally require `cleanup()` in `afterEach` to avoid DOM leak warnings across test suites.
- **Onboarding:** Instant — `npm run test` worked on the first try after configuring `vite.config.ts`.
- **Build with it again?** Absolutely. Much easier and faster than Jest.

### TypeScript (strict mode, ~5.7)
- **Used for:** end-to-end type safety against the shared API contract (Sections 4.4 and 4.6), ensuring zero runtime property mismatch when switching from mock data to real backend.
- **Worked well:** Discriminated unions (`ApiResult<T>`, `StatusLevel`, `EscalationState`) made handling error states, loading skeletons, and resolution badges compile-time safe.
- **Needs work:** `tsconfig.node.json` default configuration sometimes looks for `@types/node` which requires a separate devDependency install if node ambient types are referenced in `types: ["node"]`.
- **Onboarding:** Minutes.
- **Build with it again?** Always. Indispensable for hackathon team contracts.

### Ring Partner API & ring-sandbox (Frontend Consumer Perspective)
- **Used for:** consuming Ring motion and doorbell events (`ding`, `motion.human`, `package`) and snapshot media frames.
- **Worked well:** The normalized event model (`event_id`, `ts`, `zone`, `type`, `snapshot_url`, `visitor`) maps intuitively to chronological timeline lanes. Ding events with snapshot captures give immediate visual context for door visitors.
- **Needs work:** The Partner API webhook types (`motion_detected`, `sub_type=human`, `button_press`) differ from event query types (`motion.human`, `ding`). While Mayank normalized this in the backend ingest layer, having unified event taxonomy across Ring's webhooks and REST endpoints would save frontend developers from checking translation layers. Snapshot delivery in the sandbox returns placeholder PNGs rather than JPEG streams.
- **Onboarding:** Contract documentation in Section 4.6 was clear; mock fixture design took about 30 minutes.
- **Build with it again?** Yes. The emulator allowed building the entire frontend without physical hardware.

### Amazon Bedrock (Evening Digest & Vision Output Consumption)
- **Used for:** displaying the 80–120 word evening caregiver digest and detailed doorbell visitor security summaries (`person_count`, `uniform_or_badge`, `carrying_package`, `caution`).
- **Worked well:** The structure of Bedrock's visitor description schema provides high confidence to family members. Highlighting `caution: true` (with `caution_reason`) allowed us to build an immediate visual warning badge for unknown doorstep solicitors.
- **Needs work:** Digest generation runs at 21:00 IST, so daytime dashboard visits return 404. We had to design an empathetic empty state ("No digest yet — it arrives at 9 pm") to avoid alarming family members. Having an interim "day so far" digest would improve daytime engagement.
- **Onboarding:** The JSON response shape was straightforward to bind.
- **Build with it again?** Yes. The AI summary turns raw sensor data into meaningful elder-care reassurance.

## Friction log

| Task attempted | Steps taken | Where it broke | How we fixed it |
|---|---|---|---|
| Switch between Green, Yellow, and Red status for demo video recording | Added `?mock=green\|yellow\|red` URL parameter | Having to manually edit the browser URL during screen recording was clumsy and slow | Added dedicated one-click demo pill toggles in the dashboard header that update in-memory state and refresh the view instantly |
| Render StatusCard JSX in Vitest | Wrote `src/test/status.test.ts` with JSX markup | Esbuild failed with `ERROR: Expected ">" but found "status"` | Renamed `status.test.ts` to `status.test.tsx` so Vite invokes the JSX transform |
| Implement 24-hour activity routine chart | Evaluated third-party chart libraries (Chart.js / Recharts) | Recharts and Chart.js added 300+ kB of bundle weight and required complex canvas/SVG wrappers | Wrote a pure SVG component (`RoutineChart.tsx`) that renders the 96 15-minute slot bars directly with native SVG rects and dashed threshold lines; zero external dependencies |
| Prevent runaway polling when user switches browser tabs | Polling every 5s with `setInterval` | Network calls continued firing in background tabs, wasting bandwidth and triggering duplicate state updates | Built `usePolling` hook using the Page Visibility API (`document.visibilityState`) and `AbortController` to cancel stale in-flight requests and immediately refresh on tab focus |
| Acknowledge alert in mock mode | Clicked "I'm checking" button on active alert banner | In mock mode without a running backend, POST `/alerts/{id}/ack` would fail with network error | Implemented an in-memory mutable mock alert store in `src/api/client.ts` that transitions state to `RESOLVED`, logs the resolution time, and flips status to green |
| Node.js environment setup on macOS | Installed Node 20 via Homebrew | Node 20 was keg-only on Homebrew and initially missing symlinks in PATH | Linked node@20 into `/opt/homebrew/bin` to ensure `node -v` (v20.20.2) and `npm -v` (10.8.2) work in all subshells |

## Feature requests

| What | Why | Urgency |
|---|---|---|
| Ring Partner API: Pre-signed thumbnail URLs for doorbell dings | Currently snapshot retrieval requires separate media calls or raw blob streaming; direct CDN thumbnails in event webhooks would accelerate UI rendering | important |
| Ring Partner API: Device Battery and Online Heartbeat Status in `/homes/{id}` | Elder caregivers frequently worry whether a camera battery has died; showing battery % on the dashboard would prevent false alarm panics | important |
| Amazon Bedrock: Incremental "Mid-Day Check-in" prompt template | Parents' families check the app during lunch (12:00-14:00), 7 hours before the 21:00 digest arrives | nice-to-have |
| ring-sandbox: Simulated doorbell camera stills with realistic personas (courier, mailman, stranger) | Offline testing of computer vision / visitor detection currently relies on placeholder synthetic images | nice-to-have |
| Tailwind v4: Document `@media (prefers-color-scheme: dark)` color overrides in official `@theme` docs | The transition from v3 `darkMode: 'class'` to v4 CSS variables is undocumented in early v4 guides | nice-to-have |
