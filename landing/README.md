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
| How it works | Animated beams: Ring doorbell, cameras and motion → Saathi → Ma, the family, the neighbour |
| Help climbs one step at a time | Scroll timeline of the escalation ladder (17:05 → 17:25 on the fall day) |
| Involve family & neighbours | The Telegram alert card with a typed reply, and the neighbour card |
| Everything about today | The real dashboard in a Safari window, plus four number tickers |
| Closing + footer | Call to action and the dark olive footer strip |

### Components from the shadcn / Magic UI / Aceternity links

Copied from each library's registry into `src/components/ui/` (only the import path changed,
plus the small edits listed), then restyled with the parchment tokens:

| Component | Used for | Edits |
|---|---|---|
| Magic UI Text Animate | Every section title rises word by word out of a blur | none |
| Magic UI Word Rotate | Hero: "let Saathi keep watch / check in / call for help" | renders inline spans (it can sit in the h1) |
| Magic UI Blur Fade | All reveals (`Reveal`) | none |
| Magic UI iPhone | The three guardian phones | `children` overlay on the screen; frame colour from `--iphone-frame` |
| Magic UI Marquee | The Connect list (vertical, pauses on hover) | none |
| Magic UI Animated Beam | How it works | colours passed as props |
| Magic UI Dot Pattern | Behind the beams | one SVG `<pattern>` instead of one element per dot |
| Magic UI Safari | Dashboard preview | parchment chrome colours |
| Magic UI Number Ticker | Dashboard facts | none |
| Aceternity Timeline | The escalation ladder | parchment colours; title/sub props instead of the demo header |

`public/screens/dashboard-*.jpg` are screenshots of the dashboard on demo data (headless Chrome).
The dashboard's own login screen and charts are described in `dashboard/README.md`.

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

Neither licence requires attribution, but we credit the photographers of the photos we ship
(option 1 of each slot, plus the three hand cut-outs in `public/hands/`).

| Where on the page | Photo | Photographer |
|---|---|---|
| Hero | [Grandparents with boy](https://www.pexels.com/photo/grandparents-with-boy-18394078/) | Sagar Ahire (Pexels) |
| Ma | [Smiling woman in white dress](https://www.pexels.com/photo/smiling-woman-in-white-dress-2703082/) | Nandhu Kumar (Pexels) |
| Papa | [Smiling senior man sitting outdoors](https://www.pexels.com/photo/smiling-senior-man-sitting-outdoors-38544128/) | Zeynep Kahraman (Pexels) |
| Rahul (son) | [A smiling young man in a dark blue sweater](https://unsplash.com/photos/a-smiling-young-man-in-a-dark-blue-sweater-rifCUO-4X8k) | Josias Garibay (Unsplash) |
| Priya (daughter) | [Smiling woman in traditional attire outdoors](https://www.pexels.com/photo/smiling-woman-in-traditional-attire-outdoors-40407265/) | Subhrajyoti Paul (Pexels) |
| Aarav (grandson) | [Boy wearing red knit cap](https://www.pexels.com/photo/boy-wearing-red-knit-cap-3494565/) | Yogendra Singh (Pexels) |
| Mrs Iyer (neighbour) | [Portrait of a woman in traditional attire outdoors](https://www.pexels.com/photo/portrait-of-a-woman-in-traditional-attire-outdoors-38982379/) | Ravinder Ravi (Pexels) |
| Doorbell snapshot | [A man in red polo shirt holding a box](https://www.pexels.com/photo/a-man-in-red-polo-shirt-holding-a-box-7363160/) | RDNE Stock project (Pexels) |
| Front door at night | [Light over closed door](https://www.pexels.com/photo/light-over-closed-door-12748725/) | Erik Mclean (Pexels) |
| Phone on a table | [A cell phone sitting on top of a wooden table](https://unsplash.com/photos/a-cell-phone-sitting-on-top-of-a-wooden-table-h9sILC6lR2g) | Omar Roque (Unsplash) |
| Hand holding the phone (`hand-1.webp`, used) | [Person holding black android smartphone](https://unsplash.com/photos/person-holding-black-android-smartphone-mpzYWN5xQqc) | Олег Мороз (Unsplash) |
| `hand-2.webp` (picker option) | [Person holding phone with hustle text](https://unsplash.com/photos/person-holding-phone-with-hustle-text-41yF2vjjk0g) | Fernando Hernandez (Unsplash) |
| `hand-3.webp` (picker option) | [Person holding a mobile phone on white background](https://www.pexels.com/photo/close-up-shot-of-a-person-holding-a-mobile-phone-on-white-background-8947174/) | Kaboompics (Pexels) |

If you change a pick, move the chosen option to the top of its list in `src/photoOptions.ts` and
update its row here.

## Fonts

The design calls for ABC Arizona Flare and Sans, which are paid fonts. The page uses free Google
Fonts with the same feel: **Belleza** for headings and the wordmark, **Alegreya Sans** for body
text. The CSS lists the ABC fonts first, so they take over if they are ever licensed and installed.
