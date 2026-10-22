# Escalation ladder

Contract 4.4: `SUSPECT` → `NUDGE_PARENT` → `ALERT_FAMILY` → `ALERT_NEIGHBOUR`; any acknowledgement
goes straight to `RESOLVED`.

| State | Entered when | Side effect | Leaves after |
|---|---|---|---|
| `SUSPECT` | an anomaly opens an alert (webhook night check or minute tick) | none: a grace period in case the parent is just late | `ESC_WAIT_SUSPECT` (demo 10 s) |
| `NUDGE_PARENT` | SUSPECT timed out | Polly voice nudge prepared; `GET /homes/{id}/nudge` turns active (parent app shows the big button and plays `audio_url`) | `ESC_WAIT_NUDGE` (demo 15 s) |
| `ALERT_FAMILY` | nudge unanswered | Telegram message to the family chat with an **I'm checking** button (+ SNS if configured) | `ESC_WAIT_FAMILY` (demo 20 s) |
| `ALERT_NEIGHBOUR` | family didn't respond | same message to the neighbour chat | stays open until someone acks |
| `RESOLVED` | `POST /alerts/{id}/ack` (parent app, dashboard) or an **I'm checking** press | family gets "Priya is checking on Kamala" / "Kamala pressed I'm okay" | – |

Every transition appends `{"state", "at"}` to `steps`. Acks are idempotent: the first acker is
kept, repeats return the resolved alert.

## One core, two runtimes

`backend/escalation/ladder.py::LadderCore` does the work of each step (state change, `steps`
entry, side effects) and the resolve. Writes are conditional on the state just read, so a step and
an ack racing each other can't overwrite `RESOLVED`. What differs is who waits:

| | Local (`ESCALATOR=local`) | AWS (`ESCALATOR=stepfunctions`) |
|---|---|---|
| Start | `LocalLadder.start` arms an asyncio timer | `StepFunctionsEscalator.start` → `StartExecution` (name = alert_id, input carries the waits) |
| Waiting in a state | `loop.call_later(wait)` | Task state `lambda:invoke.waitForTaskToken` with `TimeoutSecondsPath` |
| Entering a state | timer fires → `LadderCore.enter` in a worker thread | the Task invokes the escalation-step Lambda → `run_step` → `LadderCore.enter` (stores the task token on the alert) |
| Moving up | arm the next timer | `States.Timeout` is caught → next Task |
| Ack | `LadderCore.resolve` + cancel the timer | `LadderCore.resolve` + `SendTaskSuccess(task_token)` → `Resolved` |
| Ack lands between steps | the next `enter` sees `RESOLVED` and stops | `run_step` sees `RESOLVED` and calls `SendTaskSuccess` itself |
| Telegram button | `getUpdates` long polling (`TELEGRAM_MODE=poll`) | Telegram webhook → `POST /telegram/webhook` (`TELEGRAM_MODE=webhook`) |
| Restart | `LocalLadder.resume` re-arms open alerts | executions live in Step Functions |

The state machine is `backend/escalation/state_machine.asl.json`; SAM substitutes
`${EscalationStepFunctionArn}`. `ALERT_NEIGHBOUR` waits up to a day, then the execution ends in
`Unanswered` while the alert stays open (red) on the dashboard.
