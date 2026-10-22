"""Lambda entry point for the REST API (HTTP API -> Mangum -> FastAPI).

`backend.api.main.app` is built from the Lambda environment (STORAGE=dynamo,
ESCALATOR=stepfunctions, TELEGRAM_MODE=webhook). Lifespan is off, so no in-process
scheduler or Telegram poller starts: EventBridge and Step Functions do that work.
"""

from __future__ import annotations

from mangum import Mangum

from backend.api.main import app

handler = Mangum(app, lifespan="off")
