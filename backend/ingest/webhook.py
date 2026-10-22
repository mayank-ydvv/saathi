"""`POST /webhooks/ring`: HMAC-verified Ring webhook endpoint (contract 4.6)."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import ValidationError
from ring_sandbox import webhooks
from starlette.concurrency import run_in_threadpool

from backend.ingest.service import IngestService

router = APIRouter()


def get_ingest(request: Request) -> IngestService:
    return request.app.state.ingest


@router.post("/webhooks/ring")
async def ring_webhook(request: Request, background: BackgroundTasks) -> dict[str, bool]:
    raw = await request.body()  # verify the raw bytes, never re-serialized JSON
    signature = request.headers.get(webhooks.SIGNATURE_HEADER)
    service = get_ingest(request)
    try:
        result = await run_in_threadpool(service.handle, raw, signature)
    except webhooks.SignatureError as exc:
        raise HTTPException(status_code=401, detail="invalid webhook signature") from exc
    except (ValidationError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="malformed webhook body") from exc
    if result.wants_snapshot and result.ring_ts is not None:
        background.add_task(service.attach_snapshot, result.event, result.ring_ts)
    return {"ok": True}
