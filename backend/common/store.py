"""Storage interface shared by the in-memory store (local/tests) and DynamoDB + S3 (AWS).

Every method is a key lookup or a key-range query (contract 4.5): no scans.
Records are plain JSON-style dicts in the shapes of contracts 4.2 (events), 4.3
(`routine_to_dict` output), 4.4 (alerts) and 4.5 (homes).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Protocol

from backend.common.config import Settings, get_settings

Record = dict[str, Any]


class Store(Protocol):
    # events --------------------------------------------------------------
    def put_event_if_new(self, event: Record) -> bool:
        """Store `event` unless its event_id is already stored. True if it was new."""

    def update_event(self, home_id: str, ts: str, event_id: str, fields: Record) -> None:
        """Merge `fields` (e.g. snapshot_key, visitor) into an existing event."""

    def query_events(self, home_id: str, start: datetime, end: datetime) -> list[Record]:
        """Events with start <= ts < end, oldest first."""

    # routines ------------------------------------------------------------
    def get_routine(self, home_id: str, zone: str) -> Record | None: ...

    def put_routine(self, routine: Record, expected_rev: int | None = None) -> bool:
        """`routine` is `routine_to_dict` output (home_id, zone; reads add `rev`). Each write
        bumps `rev`; with `expected_rev` it only writes if nobody wrote since. True if written."""

    def get_routines(self, home_id: str) -> dict[str, Record]:
        """zone -> routine dict for every zone that has one."""

    # alerts --------------------------------------------------------------
    def put_alert(self, alert: Record, expected_state: str | None = None) -> bool:
        """Insert/replace. With `expected_state`, only if the stored alert is still in that
        state (optimistic concurrency between ladder steps and acks). True if written."""

    def get_alert(self, home_id: str, alert_id: str) -> Record | None: ...

    def find_alert(self, alert_id: str) -> Record | None:
        """Look an alert up by id alone (the ack endpoint has no home_id)."""

    def list_alerts(self, home_id: str, limit: int = 20) -> list[Record]:
        """Newest first."""

    def get_open_alert(self, home_id: str) -> Record | None:
        """The home's unresolved alert, if any (at most one is open per home)."""

    def claim_open_alert(self, home_id: str, alert_id: str) -> bool:
        """Atomically record `alert_id` as the home's open alert. False if one is open."""

    def release_open_alert(self, home_id: str, alert_id: str) -> None:
        """Clear the home's open-alert pointer if it still points at `alert_id`."""

    # homes ---------------------------------------------------------------
    def get_home(self, home_id: str) -> Record | None: ...

    def put_home(self, home: Record) -> None: ...

    # digests -------------------------------------------------------------
    def put_digest(self, home_id: str, day: date, text: str, generated_at: str) -> Record: ...

    def get_digest(self, home_id: str, day: date) -> Record | None: ...

    def claim_digest(self, home_id: str, day: date) -> bool:
        """True for exactly one caller per home and day."""

    def release_digest(self, home_id: str, day: date) -> None: ...

    # blobs (snapshots, audio) -----------------------------------------------
    def save_blob(self, key: str, data: bytes, content_type: str) -> str:
        """Store bytes and return a URL a browser can fetch."""

    def blob_url(self, key: str) -> str:
        """URL for an already-stored blob (presigned on S3)."""

    def get_blob(self, key: str) -> tuple[bytes, str] | None:
        """(bytes, content_type), or None if missing."""


def digest_blob_key(home_id: str, day: date) -> str:
    return f"digests/{home_id}/{day.isoformat()}.json"


_store: Store | None = None


def make_store(settings: Settings) -> Store:
    if settings.storage == "dynamo":
        from backend.common.dynamo_store import DynamoStore

        return DynamoStore(settings)
    if settings.storage == "memory":
        from backend.common.memory_store import MemoryStore

        return MemoryStore(settings)
    raise ValueError(f"unknown STORAGE={settings.storage!r}; use memory or dynamo")


def get_store() -> Store:
    """Process-wide store chosen by STORAGE (memory | dynamo)."""
    global _store
    if _store is None:
        _store = make_store(get_settings())
    return _store


def set_store(store: Store | None) -> None:
    """Swap the process-wide store (tests, or `None` to rebuild from settings)."""
    global _store
    _store = store
