# Demo scenarios

Scripted days in the life of **Kamala**, a parent living alone, played against the
[ring-sandbox](https://github.com/josepha-mayo/ring-sandbox) emulator of the Ring Partner API.
They drive the Saathi demo, the engine tests and the 14-day backfill.

Kamala's home has four Ring devices, one per Saathi zone. `play_day.py` creates them in the
emulator with stable ids, so the backend can map `device_id → zone` from the `homes` record:

| Device name | Kind | `device_id` | Zone |
|---|---|---|---|
| Front Door | doorbell | `dev_front_door` | `front_door` |
| Kitchen Cam | camera | `dev_kitchen_cam` | `kitchen` |
| Living Room Cam | camera | `dev_living_room_cam` | `living_room` |
| Bedroom Cam | camera | `dev_bedroom_cam` | `bedroom` |

## The scenarios

Demo commands run from the repo root with the emulator on `:8787`. `--speed 600` means one real
second per ten virtual minutes; `--from HH:MM` sends earlier steps instantly and paces the rest.
Run time is for the paced part.

| Scenario | What it simulates | Anomaly it should trigger | Demo command | Run time |
|---|---|---|---|---|
| `normal_day` | Kamala's ordinary day: up 06:50, milk 06:55, kitchen 07:40–08:20, living room, lunch 12:45–13:20, walk 17:05–17:50, dinner 19:45–20:20, bed 21:50 | none (this is the learned routine) | `python sandbox/scenarios/play_day.py normal_day --from 06:45 --speed 600` | ~91 s |
| `fall_day` | Normal morning; last movement is the living room at 13:00, then nothing | `long_inactivity` (~17:00, 4 h of silence while awake) | `python sandbox/scenarios/play_day.py fall_day --from 12:30 --speed 60` | ~30 s, then silence |
| `late_morning` | Up at 06:50 and takes in the milk, but no kitchen until 10:40 | `late_start` for `kitchen` (usually 07:40; threshold ~08:10) | `python sandbox/scenarios/play_day.py late_morning --from 06:45 --speed 600` | ~91 s (kitchen at ~24 s) |
| `night_door` | Normal day plus a person at the front door at 02:10 | `night_activity` for `front_door` | `python sandbox/scenarios/play_day.py night_door --from 02:00 --speed 600` | ~119 s (02:10 at ~1 s) |
| `scam_visitor` | Normal day plus an unknown man ringing the doorbell at 15:10, no package, no vehicle | none from the routine checks; the visitor description should set `caution` | `python sandbox/scenarios/play_day.py scam_visitor --from 15:00 --speed 600` | ~41 s (ding at ~1 s) |
| `aide_visit` | Normal day plus a home aide: rings at 10:00, inside until 11:30 | none (the "expected visitor" contrast) | `python sandbox/scenarios/play_day.py aide_visit --from 09:55 --speed 600` | ~72 s (ding at ~0.5 s) |

## Setup

```bash
pip install "ring-sandbox[server]"
ring-sandbox serve --port 8787
ring-sandbox webhook http://localhost:8000/webhooks/ring --key change-me
```

The `--key` must equal `RING_WEBHOOK_HMAC_KEY` in `.env`. To serve real doorbell snapshots, add
`--media-dir <folder>` to `serve` with a `dev_front_door.jpg` in that folder. Without it, the
emulator serves solid-colour placeholder images.

**Cold start (14 learned days).** Before a demo, replay `normal_day` for the 14 days before today:

```bash
python sandbox/scenarios/play_day.py normal_day --days 14 --date <yesterday YYYY-MM-DD> --backdate
```

## How `play_day.py` works

The YAML files follow ring-sandbox's own scenario schema exactly (`name`, `description`, `steps`
with `offset_s`, `type`, `sub_type`, `device`), so they also play with the stock command:

```bash
ring-sandbox play sandbox/scenarios/fall_day.yml --backdate
```

In our files `offset_s` means **seconds after local midnight (Asia/Kolkata)**. Two things in
ring-sandbox 0.5.0 make a small runner necessary:

1. **No time of day in `ring-sandbox play`.** It always places a scenario so that it ends "now",
   so a 06:50 wake-up lands at whatever clock time that works out to. Saathi's checks depend on
   the time of day. `play_day.py` calls ring-sandbox's own `run(..., start=...)` with `start` set
   to local midnight of `--date` (default: today).
2. **No indoor cameras in the default world.** The emulator boots with Front Door, Backyard,
   Kitchen Chime and Front Door Sensor. `play_day.py` adds the three indoor cameras through
   `POST /_sandbox/devices`. It also replaces the default Front Door with one whose id is
   `dev_front_door`, so device names stay unique. It is idempotent, so run it any number of times.
   Run it once before plain `ring-sandbox play`, otherwise that fails with "no device named …".

Options: `--date YYYY-MM-DD`, `--days N` (N consecutive days ending at `--date`), `--speed`,
`--backdate`, `--from HH:MM`, `--no-deliver` (write history only), `--url`.

### Things to know

- **Future timestamps.** Playing today's date with `--backdate` or a high `--speed` stamps events
  later than the real clock. Webhooks are still delivered, but Ring media endpoints reject future
  timestamps, so snapshot fetches for those events fail. For snapshots, play a past `--date` or
  pace in real time.
- **One snapshot per device.** The emulator serves `<media-dir>/dev_front_door.jpg` (or
  `default.jpg`) for every doorbell event and reads it on each request. To show different
  visitors, swap that file between the `aide_visit` and `scam_visitor` shots.
- **Lifecycle webhooks.** The first run fires `device_removed` / `device_added` webhooks for the
  device changes. They are not observation events and can be ignored.
- **Webhook types.** Scenarios emit `motion_detected` with `sub_type: human` (normalised to
  `motion.human`) and `button_press` (normalised to `ding`).

## Tests

```bash
pytest sandbox/scenarios
```

The tests check that every file loads with ring-sandbox's own `load_yaml`, uses only Kamala's four
devices and stays within one day. They also cover the runner's time handling.
