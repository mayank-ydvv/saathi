"""Developer/demo routes (mounted only when DEMO_MODE=true with STORAGE=memory) and the
memory blob server.

They exist because STORAGE=memory keeps all data inside the API process: seeding, moving
the demo clock and forcing a tick have to happen in here. None of them are in contract 4.6.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from backend.common import clock
from backend.common.timeutil import local, local_date, to_iso
from backend.ingest.seed import load_routines, seed_home

router = APIRouter(prefix="/_dev", tags=["dev"])
blobs = APIRouter(tags=["dev"])


class ClockIn(BaseModel):
    local: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$", description="HH:MM IST")
    day: date | None = None
    reset: bool = False


def _clock_state() -> dict[str, Any]:
    now = clock.now()
    return {
        "now": to_iso(now),
        "local": local(now).strftime("%Y-%m-%d %H:%M:%S"),
        "offset_seconds": int(clock.offset().total_seconds()),
    }


@router.post("/seed")
def seed(request: Request) -> dict[str, Any]:
    """Seed from the configured fixtures file only; the path never comes from the request (C4)."""
    state = request.app.state
    if state.ring is None:
        raise HTTPException(status_code=503, detail="Ring client not configured")
    home = seed_home(state.store, state.ring, state.settings)
    loaded = load_routines(state.store, state.settings.routines_file, home["home_id"])
    return {"home": home, "routines_loaded": loaded}


@router.get("/clock")
def get_clock() -> dict[str, Any]:
    return _clock_state()


@router.post("/clock")
def set_clock(body: ClockIn) -> dict[str, Any]:
    if body.reset:
        clock.reset()
    elif body.local:
        clock.set_local_time(body.local, day=body.day)
    else:
        raise HTTPException(status_code=422, detail="give local (HH:MM) or reset")
    return _clock_state()


@router.post("/tick")
async def tick(request: Request) -> dict[str, Any]:
    result = await run_in_threadpool(request.app.state.scheduler.tick)
    return {
        "anomalies": [
            {"kind": a.kind, "zone": a.zone, "reason": a.reason} for a in result.anomalies
        ],
        "alerts": [a["alert_id"] for a in result.alerts],
        "rolled_over": result.rolled_over,
        "digests": result.digests,
    }


@router.post("/digest/{home_id}")
async def make_digest(home_id: str, request: Request) -> dict[str, Any]:
    state = request.app.state
    home = state.store.get_home(home_id)
    if home is None:
        raise HTTPException(status_code=404, detail=f"home {home_id} not found")
    now = clock.now()
    return await run_in_threadpool(state.scheduler.build_digest, home, local_date(now), now)


@blobs.get("/blobs/{key:path}")
def get_blob(key: str, request: Request) -> Response:
    """Serve snapshots/audio stored by MemoryStore (S3 presigned URLs replace this on AWS)."""
    blob = request.app.state.store.get_blob(key)
    if blob is None:
        raise HTTPException(status_code=404, detail="blob not found")
    data, content_type = blob
    return Response(content=data, media_type=content_type)
