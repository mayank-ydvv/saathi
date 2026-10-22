"""Lambda entry point for `POST /webhooks/ring` (HTTP API payload format 2.0).

A dedicated function so Ring webhooks don't pay the FastAPI cold start. Same pipeline as
the local endpoint: `IngestService.handle`, then the doorbell snapshot inline.
"""

from __future__ import annotations

import base64
import json
import logging
from typing import Any

from pydantic import ValidationError
from ring_sandbox import webhooks

from backend.handlers import runtime

log = logging.getLogger(__name__)


def _response(status: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def raw_body(event: dict[str, Any]) -> bytes:
    body = event.get("body") or ""
    return base64.b64decode(body) if event.get("isBase64Encoded") else body.encode()


def handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    service = runtime.ingest()
    try:
        result = service.handle(raw_body(event), headers.get(webhooks.SIGNATURE_HEADER.lower()))
    except webhooks.SignatureError:
        return _response(401, {"detail": "invalid webhook signature"})
    except (ValidationError, ValueError):
        return _response(400, {"detail": "malformed webhook body"})
    if result.wants_snapshot and result.ring_ts is not None:
        try:
            service.attach_snapshot(result.event, result.ring_ts)
        except Exception:  # never fail the delivery over a photo
            log.exception("snapshot step failed")
    return _response(200, {"ok": True})
