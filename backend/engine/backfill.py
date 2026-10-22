"""Build routines from historical events (contract 4.3).

    python -m backend.engine.backfill --input sandbox/fixtures/normal_14_days.jsonl \
        --output sandbox/fixtures/routines_home-demo-1.json

The last day of the input stays open (`today`), exactly as live ingest would leave it; the
scheduler's first tick on a later day closes it.
"""

from __future__ import annotations

import argparse
import json
from collections.abc import Iterable
from datetime import datetime
from pathlib import Path

from backend.engine.models import Event, Routine
from backend.engine.routine import TIMEZONE, new_routine, routine_to_dict, update_on_event


def build_routines(events: Iterable[Event], tz: str = TIMEZONE) -> dict[str, Routine]:
    """Replay events oldest-first into fresh per-zone routines. O(n log n) for the one sort."""
    routines: dict[str, Routine] = {}
    for e in sorted(events, key=lambda ev: ev.ts):
        r = routines.get(e.zone)
        if r is None:
            r = routines[e.zone] = new_routine(e.home_id, e.zone)
        update_on_event(r, e, tz)
    return routines


def event_from_json(d: dict) -> Event:
    """Contract 4.2 dict -> Event (UTC-aware `ts`)."""
    return Event(
        event_id=d["event_id"],
        home_id=d["home_id"],
        device_id=d["device_id"],
        zone=d["zone"],
        type=d["type"],
        ts=datetime.fromisoformat(d["ts"].replace("Z", "+00:00")),
        snapshot_key=d.get("snapshot_key"),
    )


def read_jsonl(path: Path) -> list[Event]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return [event_from_json(json.loads(line)) for line in lines if line.strip()]


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description="Build zone routines from a JSONL event file.")
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--tz", default=TIMEZONE)
    args = p.parse_args(argv)
    routines = build_routines(read_jsonl(args.input), args.tz)
    out = {zone: routine_to_dict(r) for zone, r in sorted(routines.items())}
    args.output.write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(out)} routines to {args.output}")


if __name__ == "__main__":
    main()
