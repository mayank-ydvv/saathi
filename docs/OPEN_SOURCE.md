# Open source

Saathi enters the **Open Source** mini challenge with two contributions: a library we wrote and
released, and a pull request to the open-source tool we built on. The fields below are the ones
Devpost asks for.

## 1. Elder-care scenarios for ring-sandbox (pull request upstream)

| Devpost field | Value |
|---|---|
| Contribution URL | https://github.com/josepha-mayo/ring-sandbox/pull/19 |
| Repository URL | https://github.com/josepha-mayo/ring-sandbox |
| GitHub username | `debadritahalder-coder` |
| License | MIT (the project's own) |

**What we did.** [ring-sandbox](https://github.com/josepha-mayo/ring-sandbox) is an offline
emulator of the Ring Partner API and the only way we could build Saathi without a physical Ring
device. We added three example scenarios for caretaking apps to its `examples/` folder, plus a
README section and a CHANGELOG entry:

| Scenario | What happens | Exercises |
|---|---|---|
| `night_wandering` | Front door opens 2 h 10 min into an overnight window; resident outside for 12 min | night-time door alerts |
| `unanswered_door` | Resident collects the milk, 5 h of silence, a caregiver rings twice and leaves | "last seen", inactivity, unanswered ding |
| `doorstep_stranger` | Visitor on foot, no package or vehicle, rings twice, door open 5 min | unknown-visitor / doorstep-scam warnings |

**How it works.** The scenarios use ring-sandbox's own YAML format (`offset_s`, `type`,
`sub_type`, `device`) and play on its default world (doorbell + front-door contact sensor), so
anyone with `pip install "ring-sandbox[server]"` can run `ring-sandbox play night_wandering`. The
emulator turns each step into a signed Ring webhook and a history record, exactly as for its
built-in scenarios. The files ship inside the wheel, and the project's existing tests cover them.
The project's full suite passes with the change (92 passed, 1 skipped).

**Why it matters.** The existing examples model a scheduled home-aide visit. Our scenarios add
the other half of care monitoring: what an older person living alone did, or didn't, do. That
covers a door opening at night, a day with no sign of life, and a stranger at the door with
nothing to deliver. Anyone building a Ring integration for elderly care now has ready-made test
fixtures for the checks that matter most. The scenarios are generic: nothing in them is
specific to Saathi.

Saathi's own, richer scenarios (four indoor zones, whole days) live in
[`sandbox/scenarios/`](../sandbox/scenarios/README.md).

## 2. routine-guard (new library)

| Devpost field | Value |
|---|---|
| Contribution URL | https://github.com/krishnadityasingh18-create/routine-guard |
| Repository URL | https://github.com/krishnadityasingh18-create/routine-guard |
| GitHub username | `krishnadityasingh18-create` |
| License | MIT |

**What we did.** We released Saathi's anomaly engine as a standalone, typed Python library.

**How it works.** It learns the daily rhythm of any timestamped event stream from about two
weeks of history. For each zone it keeps 96 fifteen-minute slots plus the median and spread of
the day's first activity. Three explainable rules run on top: late start, long inactivity and
night activity. It needs no ML, no cloud and only the standard library.

**Why it matters.** Every alert can be explained to a worried family in one sentence. The
library runs anywhere, and works for any "is today normal?" problem, not just Ring.

Full write-up: [OPEN_SOURCE_ENGINE.md](OPEN_SOURCE_ENGINE.md).

## Short description (for the Devpost text box)

> We contributed elder-care scenarios (night wandering, an unanswered door, a doorstep
> stranger) to ring-sandbox, the open-source Ring Partner API emulator we built on, so anyone
> testing a caretaking integration has ready-made fixtures. We also released Saathi's
> anomaly engine as routine-guard, an MIT, standard-library-only Python library that learns a
> daily routine and explains, in one sentence, when a day isn't normal.
