"""Who hears about an alert: Telegram (primary), SNS (optional second channel), or the log.

Every channel failure is caught and logged: one broken channel never blocks the ladder.
"""

from __future__ import annotations

import logging
from typing import Any, Protocol

import boto3

from backend.common.config import Settings
from backend.escalation.messages import alert_text
from backend.escalation.telegram import TelegramClient, ack_data

log = logging.getLogger(__name__)


class Notifier(Protocol):
    def alert(
        self,
        alert: dict[str, Any],
        home: dict[str, Any],
        audience: str,
        last_seen: dict[str, str] | None,
    ) -> None: ...

    def resolved(self, alert: dict[str, Any], home: dict[str, Any]) -> None: ...

    def digest(self, home: dict[str, Any], record: dict[str, Any]) -> None: ...


def resolved_text(alert: dict[str, Any], home: dict[str, Any]) -> str:
    acked = alert.get("acked_by") or {}
    parent = home.get("parent_name", "your parent")
    if acked.get("by") == "parent":
        return f'Saathi: {parent} pressed "I\'m okay". Alert resolved.'
    return f"Saathi: {acked.get('name', 'Someone')} is checking on {parent}. Alert resolved."


def digest_text(home: dict[str, Any], record: dict[str, Any]) -> str:
    title = f"Saathi evening update for {home.get('parent_name', '')} ({record['date']})"
    return f"{title}:\n\n{record['text']}"


class LogNotifier:
    """Local default when no Telegram token is configured."""

    def alert(self, alert, home, audience, last_seen) -> None:
        log.warning("[%s] %s", audience, alert_text(alert, home, last_seen))

    def resolved(self, alert, home) -> None:
        log.warning("[family] %s", resolved_text(alert, home))

    def digest(self, home, record) -> None:
        log.warning("[family] %s", digest_text(home, record))


class TelegramNotifier:
    def __init__(self, client: TelegramClient, settings: Settings) -> None:
        self._client = client
        self._fallback = {
            "family": settings.telegram_family_chat_id,
            "neighbour": settings.telegram_neighbour_chat_id,
        }

    def _chat(self, home: dict[str, Any], audience: str) -> str:
        contact = (home.get("contacts") or {}).get(audience) or {}
        return str(contact.get("telegram_chat_id") or self._fallback.get(audience) or "")

    def _send(self, chat: str, text: str, data: str | None = None) -> None:
        if not chat:
            log.warning("no Telegram chat configured; message dropped: %s", text.splitlines()[0])
            return
        self._client.send_message(chat, text, data)

    def alert(self, alert, home, audience, last_seen) -> None:
        text = alert_text(alert, home, last_seen)
        self._send(self._chat(home, audience), text, ack_data(alert["alert_id"], audience))

    def resolved(self, alert, home) -> None:
        self._send(self._chat(home, "family"), resolved_text(alert, home))

    def digest(self, home, record) -> None:
        self._send(self._chat(home, "family"), digest_text(home, record))


class SnsNotifier:
    def __init__(self, topic_arn: str, client: Any = None, region: str = "us-east-1") -> None:
        self._topic = topic_arn
        self._sns = client or boto3.client("sns", region_name=region)

    def _publish(self, subject: str, message: str) -> None:
        self._sns.publish(TopicArn=self._topic, Subject=subject[:100], Message=message)

    def alert(self, alert, home, audience, last_seen) -> None:
        self._publish(f"Saathi alert ({audience})", alert_text(alert, home, last_seen))

    def resolved(self, alert, home) -> None:
        self._publish("Saathi alert resolved", resolved_text(alert, home))

    def digest(self, home, record) -> None:
        self._publish("Saathi evening update", digest_text(home, record))


class CompositeNotifier:
    def __init__(self, channels: list[Notifier]) -> None:
        self.channels = channels

    def _each(self, method: str, *args: Any) -> None:
        for channel in self.channels:
            try:
                getattr(channel, method)(*args)
            except Exception:
                log.exception("%s.%s failed", type(channel).__name__, method)

    def alert(self, alert, home, audience, last_seen) -> None:
        self._each("alert", alert, home, audience, last_seen)

    def resolved(self, alert, home) -> None:
        self._each("resolved", alert, home)

    def digest(self, home, record) -> None:
        self._each("digest", home, record)


def make_notifier(settings: Settings, telegram: TelegramClient | None) -> CompositeNotifier:
    channels: list[Notifier] = []
    if telegram is not None:
        channels.append(TelegramNotifier(telegram, settings))
    if settings.sns_topic_arn:
        channels.append(SnsNotifier(settings.sns_topic_arn, region=settings.aws_region))
    if not channels:
        channels.append(LogNotifier())
    return CompositeNotifier(channels)
