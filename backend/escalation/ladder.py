"""Escalation ladder (contract 4.4): SUSPECT -> NUDGE_PARENT -> ALERT_FAMILY -> ALERT_NEIGHBOUR.

`LadderCore` owns the transitions and their side effects; both runtimes use it:
- `LocalLadder` (here): asyncio timers in the API process.
- Step Functions (`stepfunctions.py` + `state_machine.asl.json`): the same states as Task
  steps with callback tokens; each step Lambda calls `LadderCore.enter`.
Any ack moves straight to RESOLVED and cancels what's pending.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from datetime import datetime
from threading import Lock
from typing import Any

from backend.api.views import last_seen
from backend.common import clock
from backend.common.store import Store
from backend.common.timeutil import parse_iso, to_iso
from backend.escalation.alerts import OPEN_STATES
from backend.escalation.base import AckBy, resolve
from backend.escalation.messages import nudge_text
from backend.escalation.notifier import Notifier
from backend.escalation.voice import Voice

log = logging.getLogger(__name__)

NEXT_STATE = {
    "SUSPECT": "NUDGE_PARENT",
    "NUDGE_PARENT": "ALERT_FAMILY",
    "ALERT_FAMILY": "ALERT_NEIGHBOUR",
}


class LadderCore:
    def __init__(
        self,
        store: Store,
        notifier: Notifier,
        voice: Voice | None = None,
        now: Callable[[], datetime] = clock.now,
    ) -> None:
        self.store = store
        self.notifier = notifier
        self.voice = voice
        self._now = now
        self._lock = Lock()  # read-modify-write of one alert never interleaves with an ack

    def enter(
        self, alert_id: str, state: str, extra: dict[str, Any] | None = None
    ) -> dict[str, Any] | None:
        """Move an open alert to `state` (appending a step) and run that step's side effects.

        Returns the alert, or None if it is resolved/missing. Re-entering the current state
        only merges `extra` (e.g. a new task token) and doesn't notify again. O(1).
        """
        with self._lock:
            alert = self.store.find_alert(alert_id)
            if alert is None or alert["state"] not in OPEN_STATES:
                return None
            previous = alert["state"]
            changed = previous != state
            if changed:
                alert["state"] = state
                alert["steps"] = [*alert["steps"], {"state": state, "at": to_iso(self._now())}]
            if extra:
                alert.update(extra)
            if (changed or extra) and not self.store.put_alert(alert, expected_state=previous):
                return None  # an ack (or another step) won the race
        if changed:
            self._on_enter(alert)
        return alert

    def _on_enter(self, alert: dict[str, Any]) -> None:
        home = self.store.get_home(alert["home_id"]) or {"home_id": alert["home_id"]}
        state = alert["state"]
        try:
            if state == "NUDGE_PARENT":
                # Make the clip once here and remember it on the alert, so /nudge reuses it
                # instead of asking Polly again (L1).
                message = nudge_text(home.get("parent_name", ""), self._now())
                key = self.voice.ensure(message) if self.voice is not None else None
                alert = {**alert, "nudge_message": message, "audio_key": key}
                self.store.put_alert(alert, expected_state="NUDGE_PARENT")
            elif state in ("ALERT_FAMILY", "ALERT_NEIGHBOUR"):
                audience = "family" if state == "ALERT_FAMILY" else "neighbour"
                seen = last_seen(self.store.get_routines(alert["home_id"]))
                self.notifier.alert(alert, home, audience, seen)
        except Exception:
            log.exception("side effect for %s %s failed", alert["alert_id"], state)

    def resolve(self, alert_id: str, by: AckBy, name: str) -> tuple[dict[str, Any] | None, bool]:
        with self._lock:
            alert, changed = resolve(self.store, alert_id, by, name, self._now())
        if changed and alert is not None:
            home = self.store.get_home(alert["home_id"]) or {}
            try:
                self.notifier.resolved(alert, home)
            except Exception:
                log.exception("resolved notification failed for %s", alert_id)
        return alert, changed


class LocalLadder:
    """asyncio timers. `start`/`ack` are safe to call from worker threads."""

    def __init__(self, core: LadderCore, waits: dict[str, int]) -> None:
        self.core = core
        self.waits = waits
        self._loop: asyncio.AbstractEventLoop | None = None
        self._timers: dict[str, asyncio.TimerHandle] = {}

    def bind(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    # Escalator interface ---------------------------------------------------
    def start(self, alert: dict[str, Any]) -> None:
        self._schedule(alert["alert_id"], alert["state"], self.waits["SUSPECT"])

    def ack(self, alert_id: str, by: AckBy, name: str) -> dict[str, Any] | None:
        alert, _ = self.core.resolve(alert_id, by, name)
        self._cancel(alert_id)
        return alert

    def resume(self, home_ids: list[str]) -> int:
        """After a restart, re-arm timers for open alerts (remaining wait from the last step)."""
        count = 0
        for home_id in home_ids:
            alert = self.core.store.get_open_alert(home_id)
            if alert is None or alert["state"] not in self.waits:
                continue
            elapsed = (clock.now() - parse_iso(alert["steps"][-1]["at"])).total_seconds()
            self._schedule(alert["alert_id"], alert["state"], self.waits[alert["state"]] - elapsed)
            count += 1
        return count

    # timers ----------------------------------------------------------------
    def _schedule(self, alert_id: str, state: str, delay: float) -> None:
        if self._loop is None:
            log.warning("ladder not bound to an event loop; %s stays in %s", alert_id, state)
            return
        self._loop.call_soon_threadsafe(self._arm, alert_id, state, max(delay, 0.0))

    def _arm(self, alert_id: str, state: str, delay: float) -> None:
        assert self._loop is not None
        self._timers[alert_id] = self._loop.call_later(
            delay, lambda: self._loop.create_task(self._fire(alert_id, state))
        )

    async def _fire(self, alert_id: str, from_state: str) -> None:
        self._timers.pop(alert_id, None)
        nxt = NEXT_STATE.get(from_state)
        if nxt is None:
            return
        alert = await asyncio.to_thread(self.core.enter, alert_id, nxt)
        if alert is not None and nxt in self.waits:
            self._arm(alert_id, nxt, self.waits[nxt])

    def _cancel(self, alert_id: str) -> None:
        if self._loop is None:
            return

        def cancel() -> None:
            handle = self._timers.pop(alert_id, None)
            if handle is not None:
                handle.cancel()

        self._loop.call_soon_threadsafe(cancel)
