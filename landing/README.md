# Saathi landing page

The public front door for Saathi: a single scroll-driven page that explains what Saathi does and
links to the family dashboard. It is static (no API calls), built with Vite, React, TypeScript and
Tailwind 4, and styled from the "family almanac" design tokens (parchment, graphite, one deep-ink
button colour, a single font weight with tight letter-spacing, no shadows).

```bash
cd landing
npm install
npm run dev        # http://localhost:5175
npm run test       # Vitest
npm run lint
npm run build      # dist/
```

`VITE_DASHBOARD_URL` (see `.env.example`) sets where the "Open the dashboard" buttons go. It
defaults to the local dashboard on port 5173.

## What's on the page

| Section | What moves |
|---|---|
| Hero | Full-bleed family photo, headline, oversized "Saathi" wordmark |
| For the children who worry from afar | Scrolling dissolves the photo; each person pops out as a circle and floats round the heading, and their worry appears beside them |
| A quiet guardian, built on Ring | The circles gather into an arc and drop into a phone held in a hand (family grid screen) |
| Evening digest | The background turns rose and the phone shows the Bedrock digest with a sliding strip of the day |
| Around-the-clock guardian | Three phones rise at different speeds: late start, long inactivity, night activity |
| Effortless care | Voice nudge (live waveform + typing), doorbell vision (scanner corners), Connect ticker |
| One tap to say "I'm okay" | The parent-app nudge typed out inside a phone, then the button is tapped |
| Involve family & neighbours | The Telegram alert card with a typed reply, and the neighbour card |
| Closing + footer | Call to action and the dark olive footer strip |

The opening sequence (`src/sections/Story.tsx`) is one 760 vh section with a pinned stage; every
frame maps scroll progress to transforms and writes them straight to the DOM, so React never
re-renders while scrolling. Smooth scrolling is [Lenis](https://github.com/darkroomengineering/lenis).
`prefers-reduced-motion` turns off smooth scrolling and the looping animations.

## Photos

Every picture slot has 3–4 candidates in `src/photoOptions.ts`. In `npm run dev` a **Photos**
button (bottom right) opens a picker: click an option to see it in place, and **Copy picks** copies
the list of choices. The picker and its saved choices exist only in dev builds; a production build
always uses the first option of each slot, so a pick is made permanent by moving it to the top of
its list.

All photos are free to use under the [Unsplash licence](https://unsplash.com/license) or the
[Pexels licence](https://www.pexels.com/license/), served from their CDNs. The three hands in
`public/hands/` are cut-outs (white backdrop removed) of Unsplash photo-1605188378873 and
photo-1545947597 and Pexels 8947174.

### Photo credits

Neither licence requires attribution, but we credit the photographers of the photos we ship.
TODO: fill in once the final picks are made.

## Fonts

The design calls for ABC Arizona Flare and Sans, which are paid fonts. The page uses free Google
Fonts with the same feel: **Belleza** for headings and the wordmark, **Alegreya Sans** for body
text. The CSS lists the ABC fonts first, so they take over if they are ever licensed and installed.
