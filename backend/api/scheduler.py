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

from backend.common import clock, engine
from backend.common.config import Settings
from backend.common.events import event_from_dict
from backend.common.routine_store import update_routine
from backend.common.store import Store
from backend.common.timeutil import (
    local_date,
    local_day_bounds,
    minute_of_day,
    parse_hhmm,
    parse_iso,
    to_iso,
)
from backend.engine.anomaly import LATE_START_ZONES
from backend.engine.models import Anomaly, EngineConfig
from backend.escalation.alerts import try_open_alert
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
        for zone, routine in list(routines.items()):
            if routine.today is None or routine.today < today:  # quiet midnight
                # Conditional write (H9): a webhook landing now can't be lost, and if it
                # already rolled the day over this is a no-op.
                routines[zone], _ = update_routine(
                    self.store, home_id, zone, lambda r: engine.rollover_day(r, today)
                )
                result.rolled_over += 1
        before = {zone: dict(r.fired) for zone, r in routines.items()}
        anomalies = engine.check_tick(routines, now, self.cfg)
        for zone, routine in routines.items():  # keep the new "fired today" markers
            marks = {k: v for k, v in routine.fired.items() if before[zone].get(k) != v}
            if marks:
                update_routine(self.store, home_id, zone, lambda r, m=marks: r.fired.update(m))
        for anomaly in anomalies:
            result.anomalies.append(anomaly)
            alert, outcome = try_open_alert(self.store, anomaly, now)
            if alert is not None:
                result.alerts.append(alert)
                self.escalator.start(alert)
            elif outcome == "open":  # M2: blocked by another alert; let it fire again later
                self._unfire(home_id, anomaly, today, routines)
        digest = self._maybe_digest(home, now)
        if digest is not None:
            result.digests.append(digest)

    def _unfire(
        self, home_id: str, anomaly: Anomaly, today: date, routines: dict[str, Any]
    ) -> None:
        """Clear today's "fired" marker of a dropped anomaly. O(zones)."""
        day = today.isoformat()
        zones = list(routines) if anomaly.zone is None else [anomaly.zone]

        def clear(r):
            if r.fired.get(anomaly.kind) == day:
                del r.fired[anomaly.kind]

        for zone in zones:
            if routines.get(zone) is not None and routines[zone].fired.get(anomaly.kind) == day:
                update_routine(self.store, home_id, zone, clear)

    # digest --------------------------------------------------------------
    def _maybe_digest(self, home: dict[str, Any], now: datetime) -> dict[str, Any] | None:
        home_id, day = home["home_id"], local_date(now)
        due = parse_hhmm(home.get("digest_time") or DEFAULT_DIGEST_TIME)
        if minute_of_day(now) < due or self._digested.get(home_id) == day:
            return None
        if self.store.get_digest(home_id, day) is not None:  # already sent before a restart
            self._digested[home_id] = day
            return None
        record = self.deliver_digest(home, day, now)
        self._digested[home_id] = day  # only after it worked (H4): a failure retries next tick
        return record

    def deliver_digest(
        self, home: dict[str, Any], day: date, now: datetime
    ) -> dict[str, Any] | None:
        """Build and send the day's digest unless another runner already claimed it (H5:
        the tick and the 21:00 Lambda run together). A failure releases the claim."""
        home_id = home["home_id"]
        if not self.store.claim_digest(home_id, day):
            return None
        try:
            return self.build_digest(home, day, now)
        except Exception:
            self.store.release_digest(home_id, day)
            raise

    def _trends(self, home_id: str) -> str:
        """Weekly trends for the zones where the day starts, as sentences ("" if none).

        Optional extra: a failure here (e.g. a store error) only drops the trend line, never the
        digest itself. One BatchGet of the routines: O(zones).
        """
        try:
            routines = self.store.get_routines(home_id)
            trends = [
                engine.weekly_trend(engine.routine_from_dict(routines[zone]))
                for zone in sorted(LATE_START_ZONES & routines.keys())
            ]
        except Exception:
            log.exception("weekly trend failed for %s; digest sent without it", home_id)
            return ""
        return "".join(f" {t}." for t in trends if t)

    def build_digest(self, home: dict[str, Any], day: date, now: datetime) -> dict[str, Any]:
        """Collect the day's events + alerts, write the digest + weekly trend, store, notify."""
        home_id = home["home_id"]
        start, end = local_day_bounds(day)
        events = [event_from_dict(e) for e in self.store.query_events(home_id, start, end)]
        alerts = [
            a
            for a in self.store.list_alerts(home_id, 50)
            if start <= parse_iso(a["created_at"]) < end
        ]
        try:
            until = (
                minute_of_day(now) if local_date(now) == day else 24 * 60
            )  # quiet up to now (M1)
            text = engine.generate_digest(home, events, alerts, day, until)
        except Exception:  # generate_digest has its own Bedrock fallback; this is a last resort
            log.exception("generate_digest failed")
            text = f"{home.get('parent_name', 'Your parent')}: {len(events)} events recorded today."
        text += self._trends(home_id)
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
