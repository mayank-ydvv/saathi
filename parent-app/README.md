# Saathi parent app

One screen for the parent: a big clock, and when Saathi is worried, a voice asking "Are you
okay?" with one huge green "I'm okay" button. English and हिन्दी.

## Run

```bash
cd parent-app
npm install
cp .env.example .env.local        # VITE_USE_MOCK=true needs no backend
npm run dev                       # http://localhost:5174
```

| Variable | Default | Meaning |
|---|---|---|
| `VITE_USE_MOCK` | `true` | `true`: a fake nudge appears 10 s after load, spoken with the browser's voice. `false`: talk to the API. |
| `VITE_API_BASE` | `http://localhost:8000` | Saathi API (port 5174 is in its CORS list) |
| `VITE_HOME_ID` | `home-demo-1` | Home to watch |

Other scripts: `npm run build`, `npm run lint`, `npm run test`.

## What it does

| Screen | When | Content |
|---|---|---|
| Sound on | First visit (and after the browser blocks sound) | One big "Tap to turn on Saathi" button. Browsers block audio until a tap; the tap is remembered in `localStorage`. |
| Clock | Normal | Local time and date (Asia/Kolkata) and "Good morning/afternoon/evening, Kamala". Nothing to press. |
| Are you okay? | `GET /homes/{id}/nudge` returns `active: true` (polled every 3 s) | Full-screen question, the nudge voice (`audio_url`, else the browser's voice) repeated every 30 s, and a full-width green "I'm okay" button. |
| Thank you | After `POST /alerts/{id}/ack` with `{"by": "parent", "name": "<parent_name>"}` succeeds | "Thank you. Your family has been told you're okay." for 5 s, then back to the clock. |

If the family or neighbour resolves the alert first, the nudge simply disappears. If the ack
cannot be sent, the button stays and the text says to press again.

The language button (top right) switches every on-screen string between English and Hindi
and is remembered. The parent's name comes from `GET /homes/{id}`.

## Accessibility

- Main text (clock, greeting, question, buttons, thank-you) is 40 px or larger; secondary text
  is 28 px or larger. The "I'm okay" button is at least 160 px tall and full width.
- Every text/background pair is at least 9:1 contrast (WCAG AAA needs 7:1): ink on cream
  16.6:1, ink on the nudge yellow 15.7:1, white on the button green 9.1:1.
- One action per screen, no small touch targets; works in portrait on a phone and on a laptop.

## Code

| File | Purpose |
|---|---|
| `src/App.tsx` | Chooses the screen; ack flow; language and sound settings |
| `src/screens/*` | Idle (clock), Unlock, Nudge, Thanks |
| `src/api.ts` | HTTP client for the three endpoints, plus the mock backend |
| `src/hooks.ts` | Clock, nudge polling (one request at a time), parent name |
| `src/voice.ts` | Plays the nudge audio and repeats it; browser speech fallback |
| `src/i18n.ts` | All strings in English and Hindi |
