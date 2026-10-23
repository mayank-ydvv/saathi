"""REST endpoints used by the family dashboard and the parent app (contract 4.6)."""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from starlette.concurrency import run_in_threadpool

from backend.api import schemas, views
from backend.api.auth import require_family, require_family_or_parent
from backend.common import clock, engine
from backend.common.config import SLOTS_PER_DAY
from backend.common.store import Store
from backend.common.timeutil import hhmm, local_date, local_day_bounds, parse_iso
from backend.escalation.messages import nudge_text

router = APIRouter()

NUDGE_STATES = frozenset({"NUDGE_PARENT", "ALERT_FAMILY", "ALERT_NEIGHBOUR"})


def _store(request: Request) -> Store:
    return request.app.state.store


def _home(store: Store, home_id: str) -> dict[str, Any]:
    home = store.get_home(home_id)
    if home is None:
        raise HTTPException(status_code=404, detail=f"home {home_id} not found")
    return home


def _family_home(request: Request, home_id: str) -> dict[str, Any]:
    """The home, if the caller is a family member allowed to read it (C1/C2)."""
    home = _home(_store(request), home_id)
    require_family(request, home)
    return home


def _day(value: str | None) -> date:
    if value is None:
        return local_date(clock.now())
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="date must be YYYY-MM-DD") from exc


@router.get("/health", response_model=schemas.Health)
def health() -> dict[str, bool]:
    return {"ok": True}


@router.get("/homes/{home_id}", response_model=schemas.HomeOut)
def get_home(home_id: str, request: Request) -> dict[str, Any]:
    """The family, or the parent tablet (it shows the parent's name)."""
    home = _home(_store(request), home_id)
    require_family_or_parent(request, home)
    return {
        "home_id": home_id,
        "parent_name": home.get("parent_name", ""),
        "city": home.get("city", ""),
        "zones": views.home_zones(home),
    }


@router.get("/homes/{home_id}/status", response_model=schemas.StatusOut)
def get_status(home_id: str, request: Request) -> dict[str, Any]:
    store = _store(request)
    _family_home(request, home_id)
    return views.status(store, home_id)


@router.get("/homes/{home_id}/timeline", response_model=schemas.TimelineOut)
def get_timeline(
    home_id: str, request: Request, date: str | None = Query(default=None)
) -> dict[str, Any]:
    """One key-range Query over the local (IST) day: O(log n + k)."""
    store = _store(request)
    _family_home(request, home_id)
    day = _day(date)
    start, end = local_day_bounds(day)
    events = [
        {
            "event_id": e["event_id"],
            "ts": e["ts"],
            "zone": e["zone"],
            "type": e["type"],
            "snapshot_url": store.blob_url(e["snapshot_key"]) if e.get("snapshot_key") else None,
            "visitor": e.get("visitor"),
        }
        for e in store.query_events(home_id, start, end)
    ]
    return {"date": day.isoformat(), "events": events}


@router.get("/homes/{home_id}/alerts", response_model=schemas.AlertsOut)
def get_alerts(
    home_id: str, request: Request, limit: int = Query(default=20, ge=1, le=100)
) -> dict[str, Any]:
    store = _store(request)
    _family_home(request, home_id)
    return {"alerts": store.list_alerts(home_id, limit)}


@router.post("/alerts/{alert_id}/ack", response_model=schemas.AckOut)
async def ack_alert(alert_id: str, body: schemas.AckIn, request: Request) -> dict[str, Any]:
    """The parent tablet may say "I'm okay"; only the home's family may ack as family/neighbour."""
    store = _store(request)
    found = await run_in_threadpool(store.find_alert, alert_id)
    if found is None:
        raise HTTPException(status_code=404, detail=f"alert {alert_id} not found")
    home = _home(store, found["home_id"])
    if body.by == "parent":
        require_family_or_parent(request, home)
    else:
        require_family(request, home)
    escalator = request.app.state.escalator
    alert = await run_in_threadpool(escalator.ack, alert_id, body.by, body.name)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"alert {alert_id} not found")
    return {"alert_id": alert_id, "state": "RESOLVED"}


@router.get("/homes/{home_id}/digest", response_model=schemas.DigestOut)
def get_digest(
    home_id: str, request: Request, date: str | None = Query(default=None)
) -> dict[str, Any]:
    store = _store(request)
    _family_home(request, home_id)
    digest = store.get_digest(home_id, _day(date))
    if digest is None:
        raise HTTPException(status_code=404, detail="no digest for that date")
    return digest


@router.get("/homes/{home_id}/routine", response_model=schemas.RoutineOut)
def get_routine(home_id: str, request: Request) -> dict[str, Any]:
    """One BatchGet of the zones' routines: O(zones)."""
    store = _store(request)
    home = _family_home(request, home_id)
    routines = store.get_routines(home_id)
    zones = []
    for zone in views.home_zones(home):
        r = routines.get(zone)
        if r is None:
            zones.append(
                {"zone": zone, "usual_first": None, "hist": [0] * SLOTS_PER_DAY, "days_seen": 0}
            )
            continue
        routine = engine.routine_from_dict(r)
        zones.append(
            {
                "zone": zone,
                "usual_first": hhmm(routine.median_first),
                "hist": list(routine.hist),
                "days_seen": routine.days_seen,
            }
        )
    return {"zones": zones}


@router.get("/homes/{home_id}/nudge", response_model=schemas.NudgeOut)
def get_nudge(home_id: str, request: Request) -> dict[str, Any]:
    """Active from NUDGE_PARENT until the alert is resolved."""
    store = _store(request)
    home = _home(store, home_id)
    require_family_or_parent(request, home)
    alert = store.get_open_alert(home_id)
    if alert is None or alert["state"] not in NUDGE_STATES:
        return {"active": False, "alert_id": None, "message": None, "audio_url": None}
    nudged_at = next(
        (s["at"] for s in alert["steps"] if s["state"] == "NUDGE_PARENT"), alert["created_at"]
    )
    # Prefer what the ladder stored when it nudged (same words as the clip, no second Polly
    # call); the URL is made fresh each time because S3 presigned links expire (H7, L1).
    message = alert.get("nudge_message") or nudge_text(
        home.get("parent_name", ""), parse_iso(nudged_at)
    )
    voice = getattr(request.app.state, "voice", None)
    if alert.get("audio_key"):
        audio_url = store.blob_url(alert["audio_key"])
    else:
        audio_url = voice.audio_url(message) if voice is not None else None
    return {
        "active": True,
        "alert_id": alert["alert_id"],
        "message": message,
        "audio_url": audio_url,
    }
