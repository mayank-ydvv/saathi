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
from backend.api.scheduler import Scheduler
from backend.common import clock
from backend.common.config import Settings, get_settings
from backend.common.store import Store, make_store
from backend.common.timeutil import parse_iso
from backend.escalation.base import Escalator, ImmediateEscalator
from backend.ingest import webhook
from backend.ingest.ring_client import RingGateway
from backend.ingest.service import IngestService

log = logging.getLogger(__name__)

CORS_ORIGINS = [
    "http://localhost:5173",  # dashboard
    "http://localhost:5174",  # parent app
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]


def create_app(
    settings: Settings | None = None,
    store: Store | None = None,
    ring: RingGateway | None = None,
    escalator: Escalator | None = None,
    run_background: bool = True,
) -> FastAPI:
    """Build the app. Tests inject a store/ring/escalator and turn background loops off."""
    settings = settings or get_settings()
    store = store or make_store(settings)
    ring = ring if ring is not None else RingGateway.from_settings(settings)
    escalator = escalator or ImmediateEscalator(store)
    if settings.demo_clock_start:
        clock.set_start(parse_iso(settings.demo_clock_start))

    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        tasks = [asyncio.create_task(app.state.scheduler.run_forever())] if run_background else []
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
    app.state.ingest = IngestService(store, settings, ring=ring, escalate=escalator.start)
    app.state.scheduler = Scheduler(store, settings, escalator)
    app.state.voice = None

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
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
    if settings.storage == "memory":
        app.include_router(dev.blobs)
    if settings.demo_mode:
        app.include_router(dev.router)
    return app


app = create_app()
