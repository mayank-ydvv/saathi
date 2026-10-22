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

### npm 11
- **Used for:** installing dependencies.
- **Needs work:** `npm install` now prints `npm warn allow-scripts esbuild (postinstall …)` and skips esbuild's install script. Vite still works (esbuild's binary comes from its platform package), but the warning doesn't say whether anything is broken. CI uses Node 20 / npm 10, which doesn't have this behaviour, so the two can differ.
- **Build with it again?** Yes.

## Friction log

| Task attempted | Steps taken | Where it broke | How we fixed it |
|---|---|---|---|
| Film the mock dashboard at any hour | Mock events were anchored to the real clock | Just after midnight the day had no events and the red state read "No kitchen movement by 00:04" | In mock mode the app runs on a story clock (today 16:30 IST, or `?time=HH:MM`) |
| Strict lint in tests | Used `!` non-null assertions in tests | `@typescript-eslint/no-non-null-assertion` (strict preset) fails the lint | A tiny `must()` helper in the tests |

## Feature requests

| What | Why | Urgency |
|---|---|---|
| npm: say clearly whether skipping an install script breaks the package | The `allow-scripts` warning looks like an error to newcomers | nice-to-have |
