"""Live Bedrock smoke test: digest on the fall_day fixture + visitor on a test image.

    python scripts/bedrock_smoke.py [image ...]     (default image: sandbox/media/stranger.jpg)

Needs AWS credentials and BEDROCK_MODEL_ID (read from .env). Exits non-zero if any live call
fell back to the offline template/default.
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from backend.digest import bedrock, describe_visitor, generate_digest  # noqa: E402
from backend.engine.backfill import read_jsonl  # noqa: E402

HOME = {"home_id": "home-demo-1", "parent_name": "Kamala", "city": "Delhi"}
ALERT = {
    "reason": "No movement anywhere for 4 h 10 min (last: living room at 13:00)",
    "state": "RESOLVED",
    "acked_by": {"by": "family", "name": "Priya"},
}

live: list[bool] = []
_converse = bedrock.converse


def recording_converse(*args, **kwargs):
    text = _converse(*args, **kwargs)
    live.append(text is not None)
    return text


def main() -> int:
    bedrock.converse = recording_converse
    events = read_jsonl(ROOT / "sandbox" / "fixtures" / "fall_day.jsonl")
    digest = generate_digest(HOME, events, [ALERT], date(2026, 10, 22))
    print(f"DIGEST ({len(digest.split())} words, live={live[-1]}):\n{digest}\n")

    images = [Path(p) for p in sys.argv[1:]] or [ROOT / "sandbox" / "media" / "stranger.jpg"]
    for img in images:
        if not img.exists():
            print(f"VISITOR {img}: missing, skipped")
            continue
        v = describe_visitor(img.read_bytes())
        print(f"VISITOR {img.name} (live={bool(live) and live[-1]}): {v}")

    if not all(live):
        print("FAIL: Bedrock call failed, fallback used (see warnings above)", file=sys.stderr)
        return 1
    print("OK: all calls live")
    return 0


if __name__ == "__main__":
    sys.exit(main())
