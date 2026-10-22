"""The minute scheduler: local-midnight rollover, `check_tick` anomalies, evening digest.

`Scheduler.tick()` is plain synchronous code so the local asyncio loop, the AWS
EventBridge Lambda and tests all run exactly the same logic.
Per tick and home: one BatchGet of routines + O(zones) engine work (+ one digest a day).
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

from backend.common import clock, engine, engine_stub
from backend.common.config import Settings
from backend.common.events import event_from_dict
from backend.common.store import Store
from backend.common.timeutil import (
    local_date,
    local_day_bounds,
    minute_of_day,
    parse_hhmm,
    parse_iso,
    to_iso,
)
from backend.engine.models import Anomaly, EngineConfig
from backend.escalation.alerts import open_alert
from backend.escalation.base import Escalator

log = logging.getLogger(__name__)

DigestHook = Callable[[dict[str, Any], dict[str, Any]], None]
DEFAULT_DIGEST_TIME = "21:00"


@dataclass(slots=True)
class TickResult:
    anomalies: list[Anomaly] = field(default_factory=list)
    alerts: list[dict[str, Any]] = field(default_factory=list)
    rolled_over: int = 0
    digests: list[dict[str, Any]] = field(default_factory=list)


class Scheduler:
    def __init__(
        self,
        store: Store,
        settings: Settings,
        escalator: Escalator,
        engine_config: EngineConfig | None = None,
        on_digest: DigestHook | None = None,
        now: Callable[[], datetime] = clock.now,
    ) -> None:
        self.store = store
        self.settings = settings
        self.escalator = escalator
        self.cfg = engine_config or EngineConfig()
        self.on_digest = on_digest
        self._now = now
        self._digested: dict[str, date] = {}

    # one tick ------------------------------------------------------------
    def tick(self, now: datetime | None = None) -> TickResult:
        now = now or self._now()
        result = TickResult()
        for home_id in self.settings.home_ids:
            home = self.store.get_home(home_id)
            if home is None:
                continue
            try:
                self._tick_home(home, now, result)
            except Exception:  # one bad home must not stop the others
                log.exception("tick failed for %s", home_id)
        return result

    def _tick_home(self, home: dict[str, Any], now: datetime, result: TickResult) -> None:
        home_id, today = home["home_id"], local_date(now)
        routines = {
            zone: engine.routine_from_dict(d)
            for zone, d in self.store.get_routines(home_id).items()
        }
        for routine in routines.values():
            if routine.today is None or routine.today < today:  # quiet midnight
                engine.rollover_day(routine, today)
                self.store.put_routine(engine.routine_to_dict(routine))
                result.rolled_over += 1
        anomalies = engine.check_tick(routines, now, self.cfg)
        if anomalies:  # check_tick records "fired today" markers on the routines: keep them
            for routine in routines.values():
                self.store.put_routine(engine.routine_to_dict(routine))
        for anomaly in anomalies:
            result.anomalies.append(anomaly)
            alert = open_alert(self.store, anomaly, now)
            if alert is not None:
                result.alerts.append(alert)
                self.escalator.start(alert)
        digest = self._maybe_digest(home, now)
        if digest is not None:
            result.digests.append(digest)

    # digest --------------------------------------------------------------
    def _maybe_digest(self, home: dict[str, Any], now: datetime) -> dict[str, Any] | None:
        home_id, day = home["home_id"], local_date(now)
        due = parse_hhmm(home.get("digest_time") or DEFAULT_DIGEST_TIME)
        if minute_of_day(now) < due or self._digested.get(home_id) == day:
            return None
        self._digested[home_id] = day
        if self.store.get_digest(home_id, day) is not None:  # already sent before a restart
            return None
        return self.build_digest(home, day, now)

    def build_digest(self, home: dict[str, Any], day: date, now: datetime) -> dict[str, Any]:
        """Collect the day's events + alerts, write the digest, store it, notify. O(k)."""
        home_id = home["home_id"]
        start, end = local_day_bounds(day)
        events = [event_from_dict(e) for e in self.store.query_events(home_id, start, end)]
        alerts = [
            a
            for a in self.store.list_alerts(home_id, 50)
            if start <= parse_iso(a["created_at"]) < end
        ]
        try:
            text = engine.generate_digest(home, events, alerts, day)
        except Exception:  # Bedrock unavailable: fall back to the template digest
            log.exception("generate_digest failed; using template")
            text = engine_stub.generate_digest(home, events, alerts, day)
        record = self.store.put_digest(home_id, day, text, to_iso(now))
        if self.on_digest is not None:
            try:
                self.on_digest(home, record)
            except Exception:
                log.exception("digest notification failed for %s", home_id)
        return record

    # background loop -------------------------------------------------------
    async def run_forever(self) -> None:
        """Tick every TICK_SECONDS; store calls run in a worker thread."""
        while True:
            try:
                await asyncio.to_thread(self.tick)
            except Exception:
                log.exception("scheduler tick crashed")
            await asyncio.sleep(max(self.settings.tick_seconds, 1))
