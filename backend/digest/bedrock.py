"""Thin Amazon Bedrock Converse wrapper. Never raises: returns None so callers fall back.

Field names checked against the botocore `bedrock-runtime` service model (Converse:
modelId, messages, system, inferenceConfig; response output.message.content[].text).
"""

from __future__ import annotations

import logging
import os
from typing import Any

log = logging.getLogger(__name__)

TIMEOUT_SECONDS = 20
_client: Any = None


def client() -> Any:
    """Lazily built `bedrock-runtime` client: 20 s timeouts, one retry (2 attempts)."""
    global _client
    if _client is None:
        import boto3
        from botocore.config import Config

        _client = boto3.client(
            "bedrock-runtime",
            region_name=os.getenv("AWS_REGION", "us-east-1"),
            config=Config(
                connect_timeout=TIMEOUT_SECONDS,
                read_timeout=TIMEOUT_SECONDS,
                retries={"max_attempts": 2, "mode": "standard"},
            ),
        )
    return _client


def converse(system: str, content: list[dict], max_tokens: int = 400) -> str | None:
    """One user turn -> the model's text, or None if Bedrock is unconfigured or fails."""
    model_id = os.getenv("BEDROCK_MODEL_ID")
    if not model_id:
        return None
    try:
        resp = client().converse(
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
