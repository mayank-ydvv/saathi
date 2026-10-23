"""Lambda entry point for the daily 21:00 IST EventBridge schedule: evening digest per home.

The minute tick also sends a digest once a home's `digest_time` passes. Both go through
`Scheduler.deliver_digest`, which claims the day with a conditional write first, so a
family gets exactly one per day even when the two run at the same moment (H5).
"""

from __future__ import annotations

from typing import Any

from backend.common import clock
from backend.common.timeutil import local_date
from backend.handlers import runtime


def handler(event: dict[str, Any] | None = None, context: Any = None) -> dict[str, Any]:
    store, sched = runtime.store(), runtime.scheduler()
    now = clock.now()
    day = local_date(now)
    sent = []
    for home_id in runtime.settings().home_ids:
        home = store.get_home(home_id)
        if home is None or store.get_digest(home_id, day) is not None:
            continue
        if sched.deliver_digest(home, day, now) is not None:
            sent.append(home_id)
    return {"date": day.isoformat(), "sent": sent}
