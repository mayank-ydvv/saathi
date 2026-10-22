"""Lambda invoked by each `waitForTaskToken` Task of the escalation state machine."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import boto3

from backend.escalation.stepfunctions import run_step
from backend.handlers import runtime


@lru_cache(maxsize=1)
def _sfn() -> Any:
    return boto3.client("stepfunctions", region_name=runtime.settings().aws_region)


def handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    return run_step(runtime.escalation().core, event, _sfn())
