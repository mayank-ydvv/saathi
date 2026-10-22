"""In-memory Store for local development and tests (STORAGE=memory).

Events per home are kept in a list of sort keys (`ts#event_id`) ordered with
`bisect.insort`, so a time-range query is O(log n + k). Alert ids sort by creation time,
so "newest N" is a slice from the end. A lock makes it safe to share between the
FastAPI thread pool and the scheduler.
"""

from __future__ import annotations

import bisect
import copy
import json
from collections import defaultdict
from datetime import date, datetime
from threading import RLock

from backend.common.config import Settings
from backend.common.events import event_sort_key
from backend.common.store import Record, digest_blob_key
from backend.common.timeutil import to_iso


class MemoryStore:
    def __init__(self, settings: Settings) -> None:
        self._base_url = settings.public_base_url
        self._lock = RLock()
        self._event_keys: dict[str, list[str]] = defaultdict(list)
        self._events: dict[str, dict[str, Record]] = defaultdict(dict)  # home -> sk -> event
        self._event_ids: set[str] = set()
        self._routines: dict[str, dict[str, Record]] = defaultdict(dict)  # home -> zone -> dict
        self._alert_ids: dict[str, list[str]] = defaultdict(list)  # home -> sorted alert ids
        self._alerts: dict[str, Record] = {}  # alert_id -> alert
        self._homes: dict[str, Record] = {}
        self._blobs: dict[str, tuple[bytes, str]] = {}

    # events --------------------------------------------------------------
    def put_event_if_new(self, event: Record) -> bool:
        """O(log n) search + O(n) list insert (memmove; fine for a laptop demo)."""
        with self._lock:
            if event["event_id"] in self._event_ids:
                return False
            home, sk = event["home_id"], event_sort_key(event)
            self._event_ids.add(event["event_id"])
            self._events[home][sk] = copy.deepcopy(event)
            bisect.insort(self._event_keys[home], sk)
            return True

    def update_event(self, home_id: str, ts: str, event_id: str, fields: Record) -> None:
        """O(1)."""
        with self._lock:
            event = self._events[home_id].get(f"{ts}#{event_id}")
            if event is not None:
                event.update(copy.deepcopy(fields))

    def query_events(self, home_id: str, start: datetime, end: datetime) -> list[Record]:
        """O(log n + k): two binary searches over the sorted keys, then a slice."""
        with self._lock:
            keys = self._event_keys[home_id]
            lo = bisect.bisect_left(keys, to_iso(start))
            hi = bisect.bisect_left(keys, to_iso(end))
            events = self._events[home_id]
            return [copy.deepcopy(events[k]) for k in keys[lo:hi]]

    # routines ------------------------------------------------------------
    def get_routine(self, home_id: str, zone: str) -> Record | None:
        with self._lock:
            r = self._routines[home_id].get(zone)
            return copy.deepcopy(r) if r is not None else None

    def put_routine(self, routine: Record) -> None:
        with self._lock:
            self._routines[routine["home_id"]][routine["zone"]] = copy.deepcopy(routine)

    def get_routines(self, home_id: str) -> dict[str, Record]:
        """O(zones)."""
        with self._lock:
            return copy.deepcopy(self._routines[home_id])

    # alerts --------------------------------------------------------------
    def put_alert(self, alert: Record, expected_state: str | None = None) -> bool:
        """Insert or replace (conditionally on the stored state). O(log n) for a new id."""
        with self._lock:
            alert_id = alert["alert_id"]
            current = self._alerts.get(alert_id)
            if expected_state is not None and (current or {}).get("state") != expected_state:
                return False
            if current is None:
                bisect.insort(self._alert_ids[alert["home_id"]], alert_id)
            self._alerts[alert_id] = copy.deepcopy(alert)
            return True

    def get_alert(self, home_id: str, alert_id: str) -> Record | None:
        alert = self.find_alert(alert_id)
        return alert if alert is not None and alert["home_id"] == home_id else None

    def find_alert(self, alert_id: str) -> Record | None:
        with self._lock:
            alert = self._alerts.get(alert_id)
            return copy.deepcopy(alert) if alert is not None else None

    def list_alerts(self, home_id: str, limit: int = 20) -> list[Record]:
        """O(limit)."""
        with self._lock:
            ids = self._alert_ids[home_id][-limit:] if limit > 0 else []
            return [copy.deepcopy(self._alerts[i]) for i in reversed(ids)]

    def get_open_alert(self, home_id: str) -> Record | None:
        """O(1): only one alert is open per home and it is always the newest."""
        newest = self.list_alerts(home_id, 1)
        return newest[0] if newest and newest[0]["state"] != "RESOLVED" else None

    # homes ---------------------------------------------------------------
    def get_home(self, home_id: str) -> Record | None:
        with self._lock:
            home = self._homes.get(home_id)
            return copy.deepcopy(home) if home is not None else None

    def put_home(self, home: Record) -> None:
        with self._lock:
            self._homes[home["home_id"]] = copy.deepcopy(home)

    # digests -------------------------------------------------------------
    def put_digest(self, home_id: str, day: date, text: str, generated_at: str) -> Record:
        record = {"date": day.isoformat(), "text": text, "generated_at": generated_at}
        self.save_blob(
            digest_blob_key(home_id, day), json.dumps(record).encode(), "application/json"
        )
        return record

    def get_digest(self, home_id: str, day: date) -> Record | None:
        blob = self.get_blob(digest_blob_key(home_id, day))
        return json.loads(blob[0]) if blob else None

    # blobs ---------------------------------------------------------------
    def save_blob(self, key: str, data: bytes, content_type: str) -> str:
        with self._lock:
            self._blobs[key] = (bytes(data), content_type)
        return self.blob_url(key)

    def blob_url(self, key: str) -> str:
        return f"{self._base_url}/blobs/{key}"

    def get_blob(self, key: str) -> tuple[bytes, str] | None:
        with self._lock:
            return self._blobs.get(key)

    # helpers for tests ---------------------------------------------------
    def event_count(self, home_id: str) -> int:
        with self._lock:
            return len(self._event_keys[home_id])
