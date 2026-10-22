"""Create/refresh `home-demo-1` from the Ring device list, and load backfilled routines.

    python scripts/seed_home.py                       # STORAGE=memory: asks the running API
    python scripts/seed_home.py --routines sandbox/fixtures/routines_home-demo-1.json
    STORAGE=dynamo python scripts/seed_home.py        # writes DynamoDB directly

With STORAGE=memory the data lives inside the API process, so this script calls the
API's dev endpoint `POST /_dev/seed` (DEMO_MODE only), which runs the same seed code.
Idempotent: safe to run again.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.common.config import get_settings  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    settings = get_settings()
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--api", default=settings.public_base_url, help="API base (memory mode)")
    p.add_argument("--routines", default=settings.routines_file, help="backfill output JSON")
    args = p.parse_args(argv)

    if settings.storage == "memory":
        resp = httpx.post(
            f"{args.api}/_dev/seed", json={"routines_file": args.routines}, timeout=30
        )
        resp.raise_for_status()
        result = resp.json()
    else:
        from backend.common.store import get_store
        from backend.ingest.ring_client import RingGateway
        from backend.ingest.seed import load_routines, seed_home

        store, ring = get_store(), RingGateway.from_settings(settings)
        try:
            home = seed_home(store, ring, settings)
        finally:
            ring.close()
        result = {"home": home, "routines_loaded": load_routines(store, args.routines)}
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
