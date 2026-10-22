"""Deterministic synthetic Ring events for home-demo-1 (contract 4.2 JSONL).

    python sandbox/fixtures/generate.py          # rewrites the four .jsonl files next to this file

Normal day (local Asia/Kolkata): front door ~06:30 (milk), bedroom wake 06:45-07:15, kitchen
breakfast 07:30-08:15 / lunch ~12:30-13:30 / dinner ~19:30-20:30, front door walk ~17:00-17:45,
living room every 20-45 min from ~08:30 to ~21:30, bedroom at bedtime before 22:00.
Variants for the anomaly day: fall_day, late_morning, night_door.
"""

from __future__ import annotations

import json
import random
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

HOME_ID = "home-demo-1"
TZ = ZoneInfo("Asia/Kolkata")
SEED = 42
FIRST_NORMAL_DAY = date(2026, 10, 8)
NORMAL_DAYS = 14
ANOMALY_DAY = FIRST_NORMAL_DAY + timedelta(days=NORMAL_DAYS)  # 2026-10-22
DEVICES = {
    "front_door": "dev_front_door",
    "kitchen": "dev_kitchen_cam",
    "living_room": "dev_living_cam",
    "bedroom": "dev_bedroom_cam",
}

Raw = tuple[int, str, str]  # (local minute of day, zone, type)


def normal_day(rng: random.Random) -> list[Raw]:
    """One ordinary day as (minute, zone, type). O(events)."""
    out: list[Raw] = []

    def burst(zone: str, start: int, length: int, step: tuple[int, int] = (4, 9)) -> None:
        t = start
        while t <= start + length:
            out.append((t, zone, "motion.human" if rng.random() < 0.8 else "motion"))
            t += rng.randint(*step)

    milk = rng.randint(375, 395)  # 06:15-06:35
    out += [(milk, "front_door", "motion.human"), (milk + rng.randint(2, 6), "front_door", "ding")]
    wake = rng.randint(405, 435)  # 06:45-07:15
    burst("bedroom", wake, rng.randint(10, 20))
    burst("kitchen", rng.randint(450, 495), rng.randint(20, 35))  # breakfast 07:30-08:15
    burst("kitchen", rng.randint(750, 780), rng.randint(20, 40))  # lunch
    burst("kitchen", rng.randint(1170, 1200), rng.randint(20, 30))  # dinner
    walk = rng.randint(1020, 1035)  # 17:00-17:15 out, back 30-45 min later
    out += [
        (walk, "front_door", "motion.human"),
        (walk + rng.randint(30, 45), "front_door", "motion.human"),
    ]
    burst("living_room", rng.randint(505, 520), 1290 - 520, step=(20, 45))  # ~08:30-21:30
    burst("bedroom", rng.randint(1290, 1305), 10)  # bedtime before 22:00
    if rng.random() < 0.3:
        out.append((rng.randint(660, 720), "front_door", "package"))  # ignored by the engine
    return out


def fall_day(rng: random.Random) -> list[Raw]:
    """Normal until 13:00, then nothing."""
    return [x for x in normal_day(rng) if x[0] <= 780]


def late_morning(rng: random.Random) -> list[Raw]:
    """No kitchen activity until 10:30."""
    day = [x for x in normal_day(rng) if not (x[1] == "kitchen" and x[0] < 630)]
    return day + [(630, "kitchen", "motion.human"), (636, "kitchen", "motion.human")]


def night_door(rng: random.Random) -> list[Raw]:
    """Normal day plus the front door at 02:10."""
    return normal_day(rng) + [(130, "front_door", "motion.human"), (134, "front_door", "motion")]


def to_events(day: date, raw: list[Raw], rng: random.Random) -> list[dict]:
    """Local (minute, zone, type) -> contract 4.2 dicts with UTC `Z` timestamps, sorted."""
    midnight = datetime(day.year, day.month, day.day, tzinfo=TZ)
    events = []
    for n, (minute, zone, type_) in enumerate(sorted(raw)):
        local = midnight + timedelta(minutes=minute, seconds=rng.randint(0, 59))
        events.append(
            {
                "event_id": f"evt_{day:%Y%m%d}_{n:03d}",
                "home_id": HOME_ID,
                "device_id": DEVICES[zone],
                "zone": zone,
                "type": type_,
                "ts": local.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "snapshot_key": None,
            }
        )
    return events


def write_jsonl(path: Path, events: list[dict]) -> None:
    path.write_text("".join(json.dumps(e) + "\n" for e in events), encoding="utf-8")


def main(out_dir: Path = Path(__file__).parent) -> None:
    rng = random.Random(SEED)
    normal = []
    for d in range(NORMAL_DAYS):
        day = FIRST_NORMAL_DAY + timedelta(days=d)
        normal += to_events(day, normal_day(rng), rng)
    write_jsonl(out_dir / "normal_14_days.jsonl", normal)
    for name, variant in [
        ("fall_day", fall_day),
        ("late_morning", late_morning),
        ("night_door", night_door),
    ]:
        write_jsonl(out_dir / f"{name}.jsonl", to_events(ANOMALY_DAY, variant(rng), rng))


if __name__ == "__main__":
    main()
