# Open source: routine-guard

**Repo:** https://github.com/krishnadityasingh18-create/routine-guard (MIT)
**Install:** `pip install git+https://github.com/krishnadityasingh18-create/routine-guard`

## What it is

`routine-guard` is Saathi's anomaly engine released as a standalone Python library. It learns
the daily rhythm of any timestamped event stream from about two weeks of history, then flags
the days that break it, with one plain sentence explaining why. Nothing in it is specific to
Ring or to Saathi: zones are plain strings, the timezone, event types and every threshold are
parameters. The same code can watch a parent's home, a shop's door counter or a server's
request log.

## How it works

Each zone keeps a compact routine: a histogram of 96 fifteen-minute slots over the last 14
active days, plus the median and spread (MAD) of the first activity of the day. Three rules
run on top of it:

| Rule | Fires when | Cost |
|---|---|---|
| **late_start** | a zone has no activity today by its usual first time + max(3 × MAD, 30 min) | O(zones) per tick |
| **long_inactivity** | nothing anywhere for 4 h during waking hours (the night only counts from 06:00) | O(zones) per tick |
| **night_activity** | activity outside waking hours in a slot used on < 5% of learned days; again ≥ 30 min after the last one, max 3 a night | O(1) per event |

Learning is O(1) per event and O(D log D) once a day. Late start and inactivity fire at most once
per day and night activity at most three times a night, 30 minutes apart, so families get a few
clear alerts, not a stream. Every alert reads like a person wrote it:
*"No kitchen activity by 10:15 (usually 07:52)"*.

The library is standard-library only, typed (`py.typed`), deterministic, has no ML
dependencies, and runs its tests on Python 3.11–3.13 in GitHub Actions. Routines serialize to
plain JSON ints and strings, so they fit DynamoDB, Redis or a file.

## Why it matters

- **Explainable by design.** Elder care is about trust. Every alert can be explained to a
  worried son or daughter in one sentence; there is no black-box model to second-guess.
- **Cheap and private.** No training, no cloud inference, a few hundred integers per zone.
  It can run on a Raspberry Pi next to the router as easily as in Lambda.
- **Reusable.** Anyone building on Ring, other smart-home sensors, or any "is today normal?"
  problem can drop it in instead of rebuilding routine learning from scratch.

Inside Saathi the same logic lives in `backend/engine/` (`routine.py`, `anomaly.py`,
`trends.py`); `routine-guard` is that engine with the Saathi-specific names and constants
turned into configuration.
