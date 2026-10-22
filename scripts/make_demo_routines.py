"""Build 14 synthetic "normal" days into routines JSON for the demo.

Fallback only: the real backfill is Krishnaditya's
`python -m backend.engine.backfill --input sandbox/fixtures/normal_14_days.jsonl ...`.
This uses the same engine facade (`build_routines`), so the output has the same shape.

    python scripts/make_demo_routines.py --out .data/routines_home-demo-1.json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.common import engine  # noqa: E402
from backend.common.config import DEMO_HOME_ID, HISTORY_DAYS, TIMEZONE  # noqa: E402
from backend.common.timeutil import local_date  # noqa: E402
from backend.engine.models import Event  # noqa: E402

# Kamala's usual day (local times), matching scripts/fallback_scenarios/normal_day.yml.
USUAL_DAY = {
    "bedroom": ["06:45", "21:15"],
    "front_door": ["07:30"],
    "kitchen": ["08:05", "13:00", "19:30"],
    "living_room": ["10:00", "16:00", "20:00"],
}


def synthetic_events(today: date, days: int = HISTORY_DAYS) -> list[Event]:
    """`days` calm days ending yesterday; deterministic -2..+2 minute jitter."""
    zone = ZoneInfo(TIMEZONE)
    events = []
    for i in range(days, 0, -1):
        day = today - timedelta(days=i)
        jitter = timedelta(minutes=(i % 5) - 2)
        for z, times in USUAL_DAY.items():
            for t in times:
                h, m = (int(x) for x in t.split(":"))
                ts = datetime(day.year, day.month, day.day, h, m, tzinfo=zone) + jitter
                events.append(
                    Event(
                        f"evt_seed_{z}_{day:%Y%m%d}_{t}",
                        DEMO_HOME_ID,
                        f"seed_{z}",
                        z,
                        "motion.human",
                        ts,
                    )
                )
    return events


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--out", default=".data/routines_home-demo-1.json")
    p.add_argument("--today", help="local date YYYY-MM-DD (default: today in Asia/Kolkata)")
    args = p.parse_args(argv)
    today = (
        date.fromisoformat(args.today)
        if args.today
        else local_date(datetime.now(ZoneInfo(TIMEZONE)))
    )
    routines = engine.build_routines(synthetic_events(today))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps({z: engine.routine_to_dict(r) for z, r in routines.items()}, indent=1)
    )
    usual = {z: r.median_first for z, r in routines.items()}
    print(f"wrote {out} ({len(routines)} zones, usual first minute: {usual})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
