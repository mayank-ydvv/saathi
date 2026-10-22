"""End to end inside the app: night door webhook -> ladder -> nudge -> family -> ack."""

import asyncio
import time
from datetime import timedelta

import httpx
from ring_sandbox import webhooks

from backend.api.main import create_app
from backend.common import clock, engine
from backend.common.timeutil import local_date
from backend.escalation.ladder import LadderCore, LocalLadder
from tests.backend.conftest import device_for, signed
from tests.backend.factories import HOME, at, normal_days
from tests.backend.test_ladder import FakeNotifier

TINY = {"SUSPECT": 0.05, "NUDGE_PARENT": 0.3, "ALERT_FAMILY": 5}


async def test_night_door_escalates_to_family_and_ack_resolves(settings, store, gateway, home):
    today = local_date(clock.now())
    for r in engine.build_routines(normal_days(today - timedelta(days=14))).values():
        engine.rollover_day(r, today)
        store.put_routine(engine.routine_to_dict(r))
    notifier = FakeNotifier()
    ladder = LocalLadder(LadderCore(store, notifier), TINY)
    app = create_app(settings, store=store, ring=gateway, escalator=ladder, run_background=False)

    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as api:
            payload = webhooks.build_event(
                event_type="motion_detected",
                device_id=device_for(home, "front_door"),
                occurred_at=at(today, "02:10"),
                sub_type="human",
            )
            body, headers = signed(payload)
            assert (
                await api.post("/webhooks/ring", content=body, headers=headers)
            ).status_code == 200

            status = (await api.get(f"/homes/{HOME}/status")).json()
            assert status["status"] == "yellow" and status["reason"].startswith(
                "Front door opened at 02:10"
            )
            alert_id = status["active_alert_id"]

            await asyncio.sleep(0.15)
            nudge = (await api.get(f"/homes/{HOME}/nudge")).json()
            assert nudge["active"] and nudge["alert_id"] == alert_id
            assert nudge["audio_url"].startswith("http://localhost:8000/blobs/audio/")

            await asyncio.sleep(0.4)
            assert (await api.get(f"/homes/{HOME}/status")).json()["status"] == "red"
            assert notifier.sent == [("alert", "family", "ALERT_FAMILY")]

            started = time.monotonic()
            ack = await api.post(f"/alerts/{alert_id}/ack", json={"by": "family", "name": "Priya"})
            assert ack.json() == {"alert_id": alert_id, "state": "RESOLVED"}
            assert time.monotonic() - started < 2.0
            assert (await api.get(f"/homes/{HOME}/status")).json()["status"] == "green"
            assert (await api.get(f"/homes/{HOME}/nudge")).json()["active"] is False

            (alert,) = (await api.get(f"/homes/{HOME}/alerts")).json()["alerts"]
            assert [s["state"] for s in alert["steps"]] == [
                "SUSPECT",
                "NUDGE_PARENT",
                "ALERT_FAMILY",
                "RESOLVED",
            ]
            assert alert["acked_by"] == {"by": "family", "name": "Priya"}
