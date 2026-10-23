"""Per-container singletons for the Lambda handlers (built once per cold start)."""

from __future__ import annotations

from functools import lru_cache

from backend.api.scheduler import Scheduler
from backend.common.config import Settings, check_settings, get_settings
from backend.common.store import Store, get_store
from backend.escalation.factory import Escalation, build_escalation
from backend.ingest.ring_client import RingGateway
from backend.ingest.service import IngestService


def settings() -> Settings:
    s = get_settings()
    check_settings(s)  # e.g. refuse to run with no webhook HMAC key (M11)
    return s


def store() -> Store:
    return get_store()


@lru_cache(maxsize=1)
def escalation() -> Escalation:
    return build_escalation(settings(), store())


@lru_cache(maxsize=1)
def ring() -> RingGateway:
    return RingGateway.from_settings(settings())


@lru_cache(maxsize=1)
def ingest() -> IngestService:
    esc = escalation().escalator
    return IngestService(store(), settings(), ring=ring(), escalate=esc.start, resolve=esc.ack)


@lru_cache(maxsize=1)
def scheduler() -> Scheduler:
    esc = escalation()
    return Scheduler(store(), settings(), esc.escalator, on_digest=esc.notifier.digest)
