# Demo video script

**Length: 2:45** (limit 3:00; judges may stop at 3:00, so the first alert lands inside the first
minute). English voice-over, public on YouTube, no copyrighted music.

## Before recording

Local end-to-end run verified on 2026-10-23 (`fall_day`, real API, both frontends): alert →
parent nudge → "I'm okay" → RESOLVED by Kamala; dashboard Today/Alerts/Digest/Routine all live.
Still unverified: the rows marked below; each shot says what to do if one isn't ready.

| Needed for | What | Owner | Status |
|---|---|---|---|
| 0:15 family alert | Telegram bot token and family/neighbour chat IDs in `.env` | Mayank | not verified with a real phone yet |
| 1:05 scam visitor | Bedrock model access (`BEDROCK_MODEL_ID`); without it there's no `caution` flag | Mayank, Krishnaditya | live calls pending AWS access |
| 1:05 scam visitor | Two test photos: a stranger with no uniform or package, and a uniformed aide | Debadrita | to do |
| 0:15, 1:35 | Family dashboard showing status, timeline, alerts and the digest | Anushka | done; verified against the real API |
| 1:35 digest | Bedrock digest; otherwise a template sentence is sent | Krishnaditya | template fallback works |
| 2:00 | `docs/architecture.png` | Debadrita | done |

Already in `main`: the six scenarios, the late-start and demo-clock fixes, the parent app and the
dashboard.

## Setup

**Recording:** 1920×1080, 30 fps, system audio on (the Polly nudge must be heard), mic on,
notifications off. OBS or the Windows Game Bar (Win + Alt + R).

**Windows open (left to right):**
1. **Parent app**: phone-sized browser window (about 400×800) at `http://localhost:5174`, with
   `VITE_USE_MOCK=false` in `parent-app/.env.local`. Tap "Tap to turn on Saathi" once before
   recording.
2. **Family dashboard**: browser at `http://localhost:5173`.
3. **Telegram**: Telegram Desktop or a phone mirrored on screen, showing the family chat.
4. **Terminal**: for the scenario commands, font size 16+.

Start the stack and play one scenario per take (each `demo_run.sh` run starts a fresh in-memory
backend):

```bash
scripts/demo_run.sh fall_day --speed 1200       # take 1
scripts/demo_run.sh scam_visitor --speed 1200   # take 2
scripts/demo_run.sh normal_day --speed 1200     # take 3
```

For take 2, start the emulator with the stranger's photo as the doorbell snapshot: put it at
`<folder>/default.jpg` and add `--media-dir <folder>` to the `ring-sandbox serve` line in
`scripts/demo_run.sh` for that take.

## Shot list and voice-over

| Time | On screen | Command / action | Voice-over (exact) |
|---|---|---|---|
| **0:00–0:15** | A photo of a parent (your own family, with permission), then the Saathi title card | none | "My parents live alone, two thousand kilometres away. Like millions of Indian families, we find out something is wrong only when Papa stops picking up the phone. So we built Saathi." |
| **0:15–0:30** | Terminal playing `fall_day`; dashboard green, then the timeline stops after 13:00 | take 1 | "Saathi learns a parent's day from their Ring cameras and doorbell. Here Kamala's morning looks normal, and then, after one o'clock, nothing moves." |
| **0:30–0:45** | Dashboard turns yellow; the parent app shows "Are you okay?" and you hear the voice | wait for SUSPECT → NUDGE_PARENT | "Four hours of silence isn't normal for her. First Saathi asks Kamala herself: a voice at home, and one big button." |
| **0:45–1:05** | Nobody presses; the family's phone buzzes with the Telegram alert; tap **I'm checking**; the dashboard goes green and shows who acknowledged | let the nudge time out, then tap in Telegram | "No answer, so her daughter gets an alert with the reason and the last time Kamala was seen. One tap says I'm checking, and everyone can see that someone is on it." |
| **1:05–1:35** | Doorbell ding in the timeline; the snapshot; the visitor description with its caution warning | take 2 | "Scam visits target older people living alone. When the doorbell rings, Amazon Bedrock describes the visitor. No uniform, no package: Saathi flags it, so the family knows before the door opens." |
| **1:35–2:00** | `normal_day` sped up; the dashboard stays green all day; the evening digest arrives | take 3 | "Most days are just normal days, and the dashboard stays green. Every evening the family gets a short summary of the day, written by Amazon Bedrock." |
| **2:00–2:30** | `docs/architecture.png`, zooming along the flow | none | "Under the hood: Ring webhooks land in DynamoDB. Our anomaly engine runs on Lambda every minute through EventBridge. Step Functions runs the escalation ladder, Polly gives the nudge its voice, and Bedrock writes the digests." |
| **2:30–2:45** | The routine-guard repo, then the ring-sandbox pull request, then the closing title card | none | "The engine is open source as routine-guard, and we added elder-care scenarios to ring-sandbox. Your parents live alone. Saathi notices when their day isn't normal, and makes sure someone checks in." |

**If something isn't ready:**
- **No Telegram:** show the family message from the API log and say "her daughter gets an alert", without showing a phone.
- **No dashboard:** show `GET /homes/home-demo-1/status` and `/alerts` in the browser instead.
- **No Bedrock:** drop the caution sentence from 1:05–1:35 and only show the snapshot. Never show a warning the system didn't produce.

## Checklist before upload

- [ ] Under 3:00 (target 2:45)
- [ ] English voice-over, clear audio; captions added (YouTube auto-captions, then corrected)
- [ ] No copyrighted music: silence, or a track from the YouTube Audio Library
- [ ] Telegram and other third-party logos blurred or cropped; no real phone numbers or chat IDs visible
- [ ] No secrets on screen: `.env`, terminal history, AWS console
- [ ] Every claim in the voice-over was shown working in the same take
- [ ] Uploaded as **Public** on YouTube; link pasted into `docs/DEVPOST.md` and the Devpost form
