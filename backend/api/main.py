"""FastAPI app: REST API (contract 4.6), Ring webhook, scheduler, dev routes.

uvicorn backend.api.main:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.api import dev, routes
from backend.api.auth import Auth
from backend.api.scheduler import Scheduler
from backend.common import clock
from backend.common.config import Settings, check_settings, get_settings
from backend.common.store import Store, make_store
from backend.common.timeutil import parse_iso
from backend.escalation.base import Escalator
from backend.escalation.factory import build_escalation
from backend.escalation.ladder import LocalLadder
from backend.escalation.telegram import TelegramPoller, webhook_router
from backend.ingest import webhook
from backend.ingest.ring_client import RingGateway
from backend.ingest.service import IngestService

log = logging.getLogger(__name__)


def create_app(
    settings: Settings | None = None,
    store: Store | None = None,
    ring: RingGateway | None = None,
    escalator: Escalator | None = None,
    run_background: bool = True,
) -> FastAPI:
    """Build the app. Tests inject a store/ring/escalator and turn background loops off."""
    settings = settings or get_settings()
    check_settings(settings)
    store = store or make_store(settings)
    ring = ring if ring is not None else RingGateway.from_settings(settings)
    esc = build_escalation(settings, store)
    escalator = escalator or esc.escalator
    # The demo clock lives in this process only (H8), so it is a local (STORAGE=memory)
    # feature: on AWS the ingest/tick/step Lambdas would disagree on "now".
    local_demo = settings.demo_mode and settings.storage == "memory"
    if settings.demo_clock_start and local_demo:
        clock.set_start(parse_iso(settings.demo_clock_start))

    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        tasks: list[asyncio.Task] = []
        if isinstance(escalator, LocalLadder):
            escalator.bind(asyncio.get_running_loop())
            escalator.resume(settings.home_ids)
        if run_background:
            tasks.append(asyncio.create_task(app.state.scheduler.run_forever()))
            if esc.telegram is not None and settings.telegram_mode == "poll":
                poller = TelegramPoller(esc.telegram, escalator.ack)
                tasks.append(asyncio.create_task(poller.run_forever()))
        try:
            yield
        finally:
            for task in tasks:
                task.cancel()
            if ring is not None:
                ring.close()

    app = FastAPI(title="Saathi API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.store = store
    app.state.ring = ring
    app.state.escalator = escalator
    app.state.auth = Auth(settings)
    app.state.ingest = IngestService(
        store, settings, ring=ring, escalate=escalator.start, resolve=escalator.ack
    )
    app.state.scheduler = Scheduler(store, settings, escalator, on_digest=esc.notifier.digest)
    app.state.voice = esc.voice
    app.state.notifier = esc.notifier

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        """Contract errors are {"detail": "message"}: flatten pydantic's error list."""
        first: dict[str, Any] = exc.errors()[0] if exc.errors() else {}
        where = ".".join(str(p) for p in first.get("loc", ()) if p != "body")
        message = f"{where}: {first.get('msg', 'invalid request')}" if where else "invalid request"
        return JSONResponse(status_code=422, content={"detail": message})

    app.include_router(routes.router)
    app.include_router(webhook.router)
    if settings.telegram_mode == "webhook":
        app.include_router(webhook_router(settings.telegram_webhook_secret, lambda: esc.telegram))
    if settings.storage == "memory":
        app.include_router(dev.blobs)
    if local_demo:  # never on the deployed (DynamoDB) API (C3)
        app.include_router(dev.router)
    return app


app = create_app()
