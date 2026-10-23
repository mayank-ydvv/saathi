"""AWS runtime of the ladder: one Step Functions execution per alert.

`state_machine.asl.json` has a Task state per ladder state using
`arn:aws:states:::lambda:invoke.waitForTaskToken`. Each Task invokes the escalation-step
Lambda (`run_step`), which enters the state (side effects via `LadderCore`) and stores the
task token on the alert. The Task's timeout (from the execution input, so DEMO_MODE waits
work) moves to the next state; an ack sends `SendTaskSuccess` with the stored token, which
ends the execution in `Resolved`.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import boto3
from botocore.exceptions import ClientError

from backend.escalation.base import AckBy
from backend.escalation.ladder import LadderCore

log = logging.getLogger(__name__)


def execution_input(alert: dict[str, Any], waits: dict[str, int]) -> dict[str, Any]:
    return {
        "alert_id": alert["alert_id"],
        "home_id": alert["home_id"],
        "waits": {
            "suspect": waits["SUSPECT"],
            "nudge": waits["NUDGE_PARENT"],
            "family": waits["ALERT_FAMILY"],
        },
    }


EXPECTED_TOKEN_ERRORS = frozenset({"TaskTimedOut", "TaskDoesNotExist", "InvalidToken"})


def _send_success(sfn: Any, token: str, output: dict[str, Any]) -> bool:
    try:
        sfn.send_task_success(taskToken=token, output=json.dumps(output))
        return True
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        if code in EXPECTED_TOKEN_ERRORS:  # that step already moved on: harmless
            log.info("SendTaskSuccess ignored: %s", code)
        else:  # e.g. AccessDenied (C5): the execution keeps waiting out its timeout
            log.error("SendTaskSuccess failed (%s): the ladder execution is NOT stopped", code)
        return False


class StepFunctionsEscalator:
    def __init__(
        self,
        core: LadderCore,
        state_machine_arn: str,
        waits: dict[str, int],
        client: Any = None,
        region: str = "us-east-1",
    ) -> None:
        self.core = core
        self.arn = state_machine_arn
        self.waits = waits
        self.sfn = client or boto3.client("stepfunctions", region_name=region)

    def start(self, alert: dict[str, Any]) -> None:
        """StartExecution named after the alert, so a retried start can't double-escalate."""
        try:
            self.sfn.start_execution(
                stateMachineArn=self.arn,
                name=alert["alert_id"],
                input=json.dumps(execution_input(alert, self.waits)),
            )
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") != "ExecutionAlreadyExists":
                raise

    def ack(self, alert_id: str, by: AckBy, name: str) -> dict[str, Any] | None:
        alert, changed = self.core.resolve(alert_id, by, name)
        if changed and alert is not None and alert.get("task_token"):
            _send_success(self.sfn, alert["task_token"], {"resolved": True, "by": by})
        return alert


def run_step(core: LadderCore, event: dict[str, Any], sfn: Any) -> dict[str, Any]:
    """Body of the escalation-step Lambda, called by each waitForTaskToken Task.

    event = {"alert_id", "home_id", "state", "task_token"}. If the alert was already
    resolved, finish the execution right away instead of waiting for the timeout.
    """
    token = event["task_token"]
    alert = core.enter(event["alert_id"], event["state"], extra={"task_token": token})
    if alert is None:
        _send_success(sfn, token, {"resolved": True})
        return {"alert_id": event["alert_id"], "resolved": True}
    return {"alert_id": alert["alert_id"], "state": alert["state"]}
