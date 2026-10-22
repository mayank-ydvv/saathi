# Devpost submission text

Ready to paste into the Devpost form, one section per field. **Before submitting, re-check
every claim against what is merged and deployed that day.** The notes in *italics* are for us
and are not pasted.

---

## Project name
Saathi: Elder-Care Guardian on Ring

## Tagline
Your parents live alone. Saathi notices when their day isn't normal, and makes sure someone checks in.

## Video
`<YouTube link, public>`

## Tracks
- **Primary track:** Ring (caretaking and accessibility)
- **Mini challenges:** AWS Builder, Open Source

---

## Inspiration
Millions of Indian parents live alone while their children work in other cities. Today the
family finds out something went wrong only when Papa stops picking up the phone. A Ring doorbell
and a few cameras already see the shape of a parent's day: up at seven, kitchen by eight, the
front door for the milk. We wanted that quiet signal to bring help when the day stops looking
normal, without anyone watching a video feed.

## What it does
Saathi learns a parent's normal daily rhythm from Ring motion and doorbell events, per zone
(front door, kitchen, living room, bedroom), and watches for three things:

- **Late start:** no kitchen or bedroom activity by the usual time plus a buffer ("No kitchen movement by 08:50, usually 07:50").
- **Long inactivity:** no movement anywhere for four hours while awake.
- **Night activity:** the front door at an hour it is almost never used ("Front door opened at 02:10").

When one of these fires, Saathi doesn't wake the family straight away. It climbs an
**escalation ladder**:

1. a short grace period;
2. a spoken nudge to the parent with one huge "I'm okay" button;
3. a Telegram alert to the family with the reason and when the parent was last seen;
4. the same alert to a neighbour.

Any acknowledgement ends it, and every step is logged.

Every evening, Amazon Bedrock writes the family a short **digest** of the day. When the
**doorbell** rings, Bedrock describes the visitor from the snapshot, and Saathi flags strangers
with no uniform and no package, a common pattern in scams that target older people.

The **parent app** is one screen for a 70-year-old with poor eyesight: a big clock and, when
needed, "Are you okay?" in large text, the voice nudge, and one full-width green button. It works
in English and हिन्दी.

## How we built it
- **Ring:** we had no physical device, so we built on the Ring Partner API through `ring-sandbox`,
  an offline emulator. The code really calls the API: `RingClient` lists the devices to map them to
  rooms and fetches doorbell snapshots, and Ring-style webhooks arrive HMAC-signed and are verified
  before anything is stored. Six scripted "days in the life" (a normal day, a fall, a late
  morning, a 2 am door, a scam visitor, a carer's visit) drive the whole demo.
- **Anomaly engine:** plain statistics, not machine learning. The day is 96 fifteen-minute slots
  per zone over 14 days, plus the median and MAD of the first activity of the day. Updates are O(1)
  per event, the checks are cheap, and every alert explains itself in one sentence. We released it
  as an open-source library, **routine-guard**.
- **AWS:**
  - Amazon API Gateway and AWS Lambda for the webhook and REST API.
  - Amazon DynamoDB (four tables, keyed reads only) and Amazon S3 for snapshots, audio and digests.
  - Amazon EventBridge for the one-minute check and the 21:00 digest.
  - AWS Step Functions for the escalation ladder, using callback tokens so an "I'm okay" resumes it instantly.
  - Amazon Polly (neural voice Kajal) for the spoken nudge.
  - Amazon Bedrock (Converse API, text and vision) for digests and visitor descriptions.
  - Amazon SNS as a second alert channel.
  - All of it in one AWS SAM template.
- **Local first:** the same Python 3.11 / FastAPI handlers run on a laptop with an in-memory store,
  so the whole system can be developed and demoed without AWS.
- **Frontends:** React + Vite + TypeScript + Tailwind for the parent app and the family dashboard.

## Challenges we ran into
- **Time of day in an emulator.** Ring scenarios normally replay "relative to now", but Saathi's
  checks depend on the clock ("no kitchen by 08:10"). We built a demo clock and a scenario runner
  that pin each event to a real local time.
- **False alarms are the real enemy.** Running the real engine end to end showed that a late front
  door could open an alert that hid the real problem. We narrowed late-start checks to the kitchen
  and bedroom, added a grace period before anyone is bothered, and only count the night from 06:00.
- **No indoor cameras in the emulator's default world.** We add the kitchen, living-room and
  bedroom cameras ourselves and map devices to rooms by name.
- **Browsers block sound until a tap.** The parent app asks for one tap the first time, then
  remembers it, so the voice nudge can play later.

## Accomplishments that we're proud of
- All six scenarios verified end to end against the real engine and backend. The fall, late
  morning and night-door days each raise exactly their intended alert; the normal day, the scam
  visitor and the carer's visit raise none.
- One tap on the parent app resolves an alert. In our test the nudge appeared 2 seconds after the
  alert reached the nudge step.
- An escalation ladder that runs the same logic locally (asyncio timers) and on AWS (Step
  Functions callback tokens).
- Two open-source contributions (below).

## What we learned
- Explainable statistics beat a black box for care: a family trusts "No kitchen movement by
  10:15, usually 07:52" far more than a risk score.
- For elderly users, accessibility comes first: 7:1 contrast, 40 px text, one action per screen,
  and a voice.
- Writing product feedback as we went (see FEEDBACK.md) captured friction we would otherwise have
  forgotten.

## What's next for Saathi
- A Hindi voice for the nudge (Polly's bilingual voices), and more Indian languages.
- Weekly trends for the family ("Ma is waking 40 minutes later this week"), an early sign of declining health. The engine already computes them; the next step is showing them in the digest and on the dashboard.
- A real Ring device and the live Partner API once we have access.
- Per-home tuning of which rooms mean "the day has started".

## Built with
`ring-sandbox` · Ring Partner API · Python · FastAPI · Amazon Bedrock · Amazon Polly · AWS Step Functions · AWS Lambda · Amazon EventBridge · Amazon API Gateway · Amazon DynamoDB · Amazon S3 · Amazon SNS · AWS SAM · Telegram Bot API · React · TypeScript · Vite · Tailwind CSS

---

## Product feedback (required)
Paste the "AWS services we used and how" table and the per-tool sections from
[FEEDBACK.md](FEEDBACK.md). Optional fields: the **Friction log** and **Feature requests** sections
from the same file.

## Open Source mini challenge
From [OPEN_SOURCE.md](OPEN_SOURCE.md):

| Field | Elder-care scenarios for ring-sandbox | routine-guard |
|---|---|---|
| Contribution URL | https://github.com/josepha-mayo/ring-sandbox/pull/19 | https://github.com/krishnadityasingh18-create/routine-guard |
| Repository URL | https://github.com/josepha-mayo/ring-sandbox | https://github.com/krishnadityasingh18-create/routine-guard |
| GitHub username | `debadritahalder-coder` | `krishnadityasingh18-create` |

**Short description:** We contributed elder-care scenarios (night wandering, an unanswered door, a
doorstep stranger) to ring-sandbox, the open-source Ring Partner API emulator we built on, so
anyone testing a caretaking integration has ready-made fixtures. We also released Saathi's
anomaly engine as routine-guard, an MIT, standard-library-only Python library that learns a daily
routine and explains, in one sentence, when a day isn't normal.

## Repository
https://github.com/mayank-ydvv/saathi (MIT)

*Before submitting: if the repo is private, share it with testing@devpost.com and the five Amazon
reviewers on submission day (invites expire after 7 days).*
