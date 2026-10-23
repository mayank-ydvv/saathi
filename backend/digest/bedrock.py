"""Thin Amazon Bedrock Converse wrapper. Never raises: returns None so callers fall back.

Field names checked against the botocore `bedrock-runtime` service model (Converse:
modelId, messages, system, inferenceConfig; response output.message.content[].text).
"""

from __future__ import annotations

import logging
from typing import Any

from backend.common.config import Settings, get_settings

log = logging.getLogger(__name__)

# Worst case 2 attempts x (3 + 12) s = 30 s, well inside the 60 s ingest Lambda (M3).
CONNECT_TIMEOUT_SECONDS = 3
READ_TIMEOUT_SECONDS = 12
_client: Any = None


def client(settings: Settings | None = None) -> Any:
    """Lazily built `bedrock-runtime` client: short timeouts, one retry (2 attempts)."""
    global _client
    if _client is None:
        import boto3
        from botocore.config import Config

        _client = boto3.client(
            "bedrock-runtime",
            region_name=(settings or get_settings()).aws_region,
            config=Config(
                connect_timeout=CONNECT_TIMEOUT_SECONDS,
                read_timeout=READ_TIMEOUT_SECONDS,
                retries={"max_attempts": 2, "mode": "standard"},
            ),
        )
    return _client


def converse(
    system: str, content: list[dict], max_tokens: int = 400, settings: Settings | None = None
) -> str | None:
    """One user turn -> the model's text, or None if Bedrock is unconfigured or fails.

    Model and region come from `settings` (default: the process settings), not straight
    from os.environ, so injected settings are honoured (L9)."""
    settings = settings or get_settings()
    model_id = settings.bedrock_model_id
    if not model_id:
        return None
    try:
        resp = client(settings).converse(
            modelId=model_id,
            system=[{"text": system}],
            messages=[{"role": "user", "content": content}],
            inferenceConfig={"maxTokens": max_tokens, "temperature": 0.2},
        )
        parts = resp["output"]["message"]["content"]
        text = "".join(p.get("text", "") for p in parts).strip()
        return text or None
    except Exception:  # any Bedrock/network/shape problem -> deterministic fallback
        log.warning("bedrock converse failed", exc_info=True)
        return None
