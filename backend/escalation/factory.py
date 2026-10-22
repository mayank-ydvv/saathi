"""Build the escalation stack from settings (shared by the API and the Lambda handlers)."""

from __future__ import annotations

from dataclasses import dataclass

from backend.common.config import Settings
from backend.common.store import Store
from backend.escalation.base import Escalator
from backend.escalation.ladder import LadderCore, LocalLadder
from backend.escalation.notifier import CompositeNotifier, make_notifier
from backend.escalation.telegram import TelegramClient
from backend.escalation.voice import Voice


@dataclass(slots=True)
class Escalation:
    escalator: Escalator
    core: LadderCore
    notifier: CompositeNotifier
    voice: Voice
    telegram: TelegramClient | None


def build_escalation(settings: Settings, store: Store) -> Escalation:
    telegram = TelegramClient(settings.telegram_bot_token) if settings.telegram_bot_token else None
    notifier = make_notifier(settings, telegram)
    voice = Voice(store, region=settings.aws_region)
    core = LadderCore(store, notifier, voice)
    escalator: Escalator
    if settings.escalator == "stepfunctions":
        from backend.escalation.stepfunctions import StepFunctionsEscalator

        escalator = StepFunctionsEscalator(
            core, settings.state_machine_arn, settings.waits, region=settings.aws_region
        )
    else:
        escalator = LocalLadder(core, settings.waits)
    return Escalation(escalator, core, notifier, voice, telegram)
