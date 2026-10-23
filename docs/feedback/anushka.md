# Product feedback: Anushka (family dashboard)

Notes written as we build. One section per tool, then the friction log and feature requests.

## Tools

### Vite 6
- **Used for:** dev server (port 5173), production build, `--mode` env files for mock vs real API.
- **Worked well:** instant start; `import.meta.env` with typed `ImportMetaEnv` keeps settings in one place.
- **Needs work:** nothing so far.
- **Onboarding:** minutes, copying the team's parent-app config.
- **Build with it again?** Yes.

### Tailwind CSS 4 (`@tailwindcss/vite`)
- **Used for:** all styling; design tokens as CSS variables mapped with `@theme inline`, so dark mode is one `prefers-color-scheme` block instead of `dark:` on every element.
- **Worked well:** no config file; tokens live in CSS.
- **Needs work:** the difference between `@theme` and `@theme inline` (needed when a token points at a CSS variable that changes in dark mode) is easy to miss in the docs.
- **Onboarding:** about 15 minutes to get the token approach right.
- **Build with it again?** Yes.

### Vitest 3 + Testing Library + jsdom
- **Used for:** unit tests (IST time maths, API client, mock backend) and component tests.
- **Worked well:** shares Vite's config; fake timers made the mock client's delay and cancellation easy to test.
- **Needs work:** nothing so far.
- **Onboarding:** minutes.
- **Build with it again?** Yes.

### React Router 6.30
- **Used for:** the four tabs (`/`, `/alerts`, `/digest`, `/routine`) with `NavLink` active states.
- **Worked well:** small API; `MemoryRouter` makes screen tests easy.
- **Needs work:** every test run printed two "v7 future flag" warnings until we passed `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` to both `BrowserRouter` and `MemoryRouter`; the warning names the flags but not that tests' routers need them too.
- **Onboarding:** minutes.
- **Build with it again?** Yes (or v7 when the team upgrades).

### Testing Library + jsdom (component tests)
- **Used for:** rendering whole screens on mock data and clicking "I'm checking".
- **Worked well:** role/name queries (`getByRole("region", { name: "Open alert" })`) double as an accessibility check.
- **Needs work:** jsdom doesn't implement `HTMLDialogElement.showModal()`, so the visitor panel needs a fallback to the `open` attribute in tests.
- **Build with it again?** Yes.

### Saathi REST API (our backend, contract 4.6)
- **Used for:** everything the dashboard shows; checked against a live `uvicorn` + `ring-sandbox` run of `fall_day`.
- **Worked well:** every response matched the contract types exactly (no adapters needed); `{"detail": "…"}` errors map cleanly to friendly messages; CORS for 5173 worked first time.
- **Needs work:** the backend's demo clock (scenarios jump to e.g. 17:05) made the browser's real time disagree with the data ("Last seen: just now" for a 13:00 event). We follow `GET /_dev/clock` when it exists; a documented, non-dev way to read "server now" would be cleaner.
- **Onboarding:** `scripts/demo_run.sh fall_day` to a red dashboard in under 2 minutes.
- **Build with it again?** Yes.

### ring-sandbox (via the team's demo script)
- **Used for:** driving the real-API test: emulator → signed webhooks → backend → dashboard turning yellow then red.
- **Worked well:** realistic end-to-end flow without any Ring hardware.
- **Needs work:** placeholder snapshots are tiny PNGs, so the visitor panel can't be judged on real images without `--media-dir`.
- **Build with it again?** Yes.

### npm 11
- **Used for:** installing dependencies.
- **Needs work:** `npm install` now prints `npm warn allow-scripts esbuild (postinstall …)` and skips esbuild's install script. Vite still works (esbuild's binary comes from its platform package), but the warning doesn't say whether anything is broken. CI uses Node 20 / npm 10, which doesn't have this behaviour, so the two can differ.
- **Build with it again?** Yes.

### Web Notifications API
- **Used for:** the escalated-alert push (status turns red → notification, click focuses the tab on Today) and the one-time prompt on the Today screen.
- **Worked well:** a data-URL SVG icon for the notification means no `public/` asset copied around; permission can be read live off `Notification.permission`, so granting it in one prompt instance lets every other hook instance fire immediately; the `localStorage` flag keeps "Not now" honest.
- **Needs work:** jsdom has no `Notification` at all, so tests install a fake with a switchable permission (`src/test/fakeNotification.ts`); Safari and iOS support is limited (iOS needs an installed PWA), so the prompt is Chrome/Android-first in practice; permission persists globally, so clearing site data resets the banner.
- **Build with it again?** Yes.

### Pull-to-refresh (touch events + CSS `overscroll-behavior`)
- **Used for:** the mobile gesture on every screen (top indicator + "Updated just now" toast).
- **Worked well:** `overscroll-behavior-y: contain` on `body` keeps Chrome's native page refresh from double-firing; threshold logic is plain px maths on touch events, no library.
- **Needs work:** jsdom has no `TouchEvent` and no real scroll, so tests dispatch plain `Event("touchmove")` objects with a fake `touches` list and swap `window.scrollY` for a get/set property descriptor they restore afterwards.

## Friction log

| Task attempted | Steps taken | Where it broke | How we fixed it |
|---|---|---|---|
| Film the mock dashboard at any hour | Mock events were anchored to the real clock | Just after midnight the day had no events and the red state read "No kitchen movement by 00:04" | In mock mode the app runs on a story clock (today 16:30 IST, or `?time=HH:MM`) |
| Share a helper from a component file | Exported `peaks()` next to `RoutineChart` | `react-refresh/only-export-components` warns (Fast Refresh only works for component-only files) | Moved helpers to `src/lib/` |
| Hour labels on a 375px phone | 00:00 … 24:00 under each lane | Labels overlapped ("00:0006:00") | Show "00 06 12 18 24" below the `sm` breakpoint |
| Real-API demo with the backend's demo clock | Ran `fall_day` (backend clock 17:05) and opened the dashboard (device time 00:28) | Timeline now-line at 00:28 and "Last seen: just now" for 13:00 events | Follow `GET /_dev/clock` in real mode; `useNow` re-renders as soon as the first sync lands |
| Screenshots at 1280 px in an embedded browser pane | Emulated a 1280 px viewport wider than the pane | Captures came out cropped/misplaced (layout itself measured correctly: 240 px nav + 1024 px main) | Took laptop shots at 1024 px; verified 1280 by measuring the DOM |
| Strict lint in tests | Used `!` non-null assertions in tests | `@typescript-eslint/no-non-null-assertion` (strict preset) fails the lint | A tiny `must()` helper in the tests |
| Add browser notifications | Called `Notification` directly | jsdom has none, so the hook had to degrade to a no-op and tests needed a fake | `useNotifications` unfailable where the API is missing; a fake stands in under tests |
| aria-current on the active tab | Tried to set the attribute from NavLink's className render-prop | Render props can style the link but can't set attributes on it | Computed the active state with `useMatch({ path, end })` and set `aria-current` alongside the styling |
| Keyboard time on 40+ timeline marks | Every mark was tabbable | Tab-stepping through a lane is tedious | Roving tabindex per lane (new `useRovingTabIndex` hook): Tab lands once, arrows walk the marks |

## Feature requests

| What | Why | Urgency |
|---|---|---|
| npm: say clearly whether skipping an install script breaks the package | The `allow-scripts` warning looks like an error to newcomers | nice-to-have |
| Browsers: one way to detect "notifications possible" | The API is defined-but-denied in some embedded browsers, so "default" isn't always a meaningful prompt state | nice-to-have |
| Programmable scroll in jsdom | Real `scrollY` (or a scroll container) would let pull-to-refresh and sticky-header tests be physical instead of descriptor-swaps | nice-to-have |
