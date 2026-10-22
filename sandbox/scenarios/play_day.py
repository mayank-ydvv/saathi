"""Play a Saathi scenario against the ring-sandbox emulator at real local clock times.

`ring-sandbox play` always places a scenario so that it ends "now", which loses the
time of day the anomaly engine depends on. This runner uses ring-sandbox's own
`load_yaml` and `run(start=...)` so that `offset_s` means "seconds after local midnight"
(Asia/Kolkata) on a chosen date. It also adds Kamala's indoor cameras if they are missing.

Examples (from the repo root, emulator running on :8787):
    python sandbox/scenarios/play_day.py fall_day --speed 600
    python sandbox/scenarios/play_day.py normal_day --days 14 --date 2026-10-21 --backdate
    python sandbox/scenarios/play_day.py scam_visitor --from 15:00 --speed 60
"""

from __future__ import annotations

import argparse
from dataclasses import replace
from datetime import UTC, date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from ring_sandbox.scenarios import Scenario, load_yaml, run

SCENARIO_DIR = Path(__file__).resolve().parent
DEFAULT_URL = "http://127.0.0.1:8787"

# Asia/Kolkata is UTC+05:30 with no daylight saving, so a fixed offset is exact and
# avoids needing the tzdata package on Windows.
IST = timezone(timedelta(hours=5, minutes=30), "Asia/Kolkata")

# (kind, name, zone). Names match backend/ingest/seed.py, which maps devices to zones by
# name, so the runner and `seed_home` can run in either order and share the same devices.
DEVICES: list[tuple[str, str, str]] = [
    ("doorbell", "Front Door", "front_door"),  # already in the emulator's default world
    ("camera", "Kitchen Cam", "kitchen"),
    ("camera", "Living Room Cam", "living_room"),
    ("camera", "Bedroom Cam", "bedroom"),
]


def resolve_path(name_or_path: str) -> Path:
    """Accept `fall_day`, `fall_day.yml` or a path to any scenario YAML."""
    path = Path(name_or_path)
    if path.suffix in (".yml", ".yaml"):
        return path
    return SCENARIO_DIR / f"{name_or_path}.yml"


def local_midnight(day: date) -> datetime:
    """Midnight of `day` in Asia/Kolkata, as an aware datetime."""
    return datetime.combine(day, time(0, 0), tzinfo=IST)


def parse_hhmm(value: str) -> int:
    """'15:00' -> seconds after midnight."""
    hours, minutes = value.split(":")
    return int(hours) * 3600 + int(minutes) * 60


def split_at(scenario: Scenario, from_s: int) -> tuple[Scenario, Scenario]:
    """Split into (steps before `from_s`, steps from `from_s` on, re-based to 0). O(n)."""
    before = [s for s in scenario.steps if s.offset_s < from_s]
    after = [
        replace(s, offset_s=s.offset_s - from_s) for s in scenario.steps if s.offset_s >= from_s
    ]
    return replace(scenario, steps=before), replace(scenario, steps=after)


def ensure_devices(http: httpx.Client) -> dict[str, str]:
    """Add any of Kamala's devices that are missing (by name); return {device_id: zone}.

    Never removes or renames devices, so ids already seeded into the home stay valid.
    Idempotent: safe to call before every run. O(devices).
    """
    by_name = {d["name"]: d["id"] for d in http.get("/_sandbox/state").json()["devices"]}
    for kind, name, _ in DEVICES:
        if name not in by_name:
            resp = http.post("/_sandbox/devices", json={"kind": kind, "name": name})
            resp.raise_for_status()
            by_name[name] = resp.json()["data"]["id"]
    return {by_name[name]: zone for _, name, zone in DEVICES}


def print_events(events: list[dict[str, Any]], zone_of: dict[str, str]) -> None:
    """Print each delivered webhook as local time, type, sub_type, zone, device id."""
    for ev in events:
        attrs = ev["data"]["attributes"]
        at = datetime.fromtimestamp(attrs["timestamp"] / 1000, tz=UTC).astimezone(IST)
        source = attrs["source"]
        print(
            f"{at:%Y-%m-%d %H:%M:%S} IST  {ev['data']['type']:<16} "
            f"{attrs.get('sub_type') or '':<7} {zone_of.get(source, '?'):<12} {source}"
        )


def play_one_day(scenario: Scenario, day: date, args: argparse.Namespace) -> list[dict[str, Any]]:
    """Play `scenario` on `day`. Steps before --from are sent instantly; the rest are paced."""
    start = local_midnight(day)
    common = {"backdate": args.backdate, "deliver": not args.no_deliver}
    if args.from_time is None:
        return run(scenario, args.url, speed=args.speed, start=start, **common)
    from_s = parse_hhmm(args.from_time)
    early, late = split_at(scenario, from_s)
    events = run(early, args.url, backdate=True, start=start, deliver=common["deliver"])
    later_start = start + timedelta(seconds=from_s)
    return events + run(late, args.url, speed=args.speed, start=later_start, **common)


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("scenario", help="scenario name in sandbox/scenarios/ or a YAML path")
    p.add_argument("--url", default=DEFAULT_URL, help="emulator base URL")
    p.add_argument("--date", type=date.fromisoformat, help="local date to play (default: today)")
    p.add_argument("--days", type=int, default=1, help="play N consecutive days ending at --date")
    p.add_argument("--speed", type=float, default=1.0, help="virtual seconds per real second")
    p.add_argument("--backdate", action="store_true", help="send every step at once")
    p.add_argument("--from", dest="from_time", metavar="HH:MM", help="pace only from this time")
    p.add_argument("--no-deliver", action="store_true", help="write history, skip webhooks")
    args = p.parse_args(argv)

    scenario = load_yaml(str(resolve_path(args.scenario)))
    last_day = args.date or datetime.now(tz=IST).date()
    with httpx.Client(base_url=args.url, timeout=10.0) as http:
        zone_of = ensure_devices(http)
    for back in range(args.days - 1, -1, -1):
        day = last_day - timedelta(days=back)
        print(f"# {scenario.name} on {day} ({len(scenario.steps)} steps)")
        print_events(play_one_day(scenario, day, args), zone_of)


if __name__ == "__main__":
    main()
