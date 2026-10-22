"""Play a scenario YAML through the ring-sandbox emulator on Saathi's demo clock.

    python scripts/demo_driver.py scripts/fallback_scenarios/fall_day.yml --speed 600

Why not plain `ring-sandbox play`: `play` back-dates events relative to the real "now", but
the backend's minute scheduler needs "now" to match the story (otherwise it sees 19:30 with
no events yet and raises false alarms). For each step this driver:
  1. moves the demo clock to the step's story time (`POST /_dev/clock`),
  2. injects the step through the emulator (`POST /_sandbox/events`, the same call
     `ring-sandbox play`/`inject` make), which signs and delivers the webhook,
  3. waits until the API has stored it, so the next clock move can't race the delivery.
Then it jumps to `check_at` (if set) and forces a scheduler tick.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import httpx
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.common.config import DEMO_HOME_ID, get_settings  # noqa: E402
from backend.ingest.ring_client import RingGateway  # noqa: E402


def hhmm_plus(start: str, seconds: float) -> str:
    h, m = (int(x) for x in start.split(":"))
    total = (h * 60 + m + int(seconds // 60)) % (24 * 60)
    return f"{total // 60:02d}:{total % 60:02d}"


def event_count(api: httpx.Client) -> int:
    today = api.get("/_dev/clock").json()["local"][:10]
    return len(api.get(f"/homes/{DEMO_HOME_ID}/timeline", params={"date": today}).json()["events"])


def wait_for_count(api: httpx.Client, target: int, timeout: float = 5.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if event_count(api) >= target:
            return True
        time.sleep(0.1)
    return False


def play(path: Path, api_base: str, ring_base: str, speed: float) -> int:
    scenario = yaml.safe_load(path.read_text())
    start = scenario.get("story_start")
    if not start:
        raise SystemExit(f"{path}: add story_start: 'HH:MM' so the demo clock knows the time")
    settings = get_settings()
    ring = RingGateway(ring_base, settings.ring_token)
    devices = {d.name: d.id for d in ring.list_devices()}
    api = httpx.Client(base_url=api_base, timeout=10)
    control = httpx.Client(base_url=ring_base, timeout=10)

    print(f"== {scenario['name']}: {scenario.get('description', '')}")
    previous = 0.0
    for step in scenario["steps"]:
        offset = float(step["offset_s"])
        time.sleep(max(offset - previous, 0) / speed)
        previous = offset
        story = hhmm_plus(start, offset)
        api.post("/_dev/clock", json={"local": story}).raise_for_status()
        before = event_count(api)
        name = step.get("device")
        body = {
            "device_id": devices[name] if name else None,
            "type": step.get("type", "motion_detected"),
            "sub_type": step.get("sub_type"),
        }
        control.post("/_sandbox/events", json=body).raise_for_status()
        stored = wait_for_count(api, before + 1)
        label = f"{body['type']}{'/' + body['sub_type'] if body['sub_type'] else ''}"
        outcome = "stored" if stored else "NOT STORED"
        print(f"  {story}  {label:<24} {name or '(first camera)':<16} {outcome}")

    check_at = scenario.get("check_at")
    if check_at:
        api.post("/_dev/clock", json={"local": check_at}).raise_for_status()
        result = api.post("/_dev/tick").json()
        print(f"  {check_at}  scheduler tick -> {result['anomalies'] or 'no anomalies'}")
        for digest in result["digests"]:
            print(f"  digest: {digest['text']}")
    status = api.get(f"/homes/{DEMO_HOME_ID}/status").json()
    print(f"== status now: {status['status']} {status['reason'] or ''}")
    ring.close()
    return 0


def main(argv: list[str] | None = None) -> int:
    settings = get_settings()
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("scenario", type=Path)
    p.add_argument("--api", default=settings.public_base_url)
    p.add_argument("--ring", default=settings.ring_api_base)
    p.add_argument("--speed", type=float, default=600.0, help="story seconds per real second")
    args = p.parse_args(argv)
    return play(args.scenario, args.api, args.ring, args.speed)


if __name__ == "__main__":
    raise SystemExit(main())
