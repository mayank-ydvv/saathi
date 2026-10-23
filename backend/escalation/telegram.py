"""Telegram Bot API: alerts with an "I'm checking" button, and button presses -> ack.

Bot API methods used (https://core.telegram.org/bots/api): sendMessage (with an inline
keyboard), getUpdates (long polling, local) or a webhook (AWS), answerCallbackQuery.
Button callback data is "ack:<alert_id>:<family|neighbour>" (well under the 64-byte limit).
"""

from __future__ import annotations

import asyncio
import hmac
import logging
from collections.abc import Callable
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request
from starlette.concurrency import run_in_threadpool

log = logging.getLogger(__name__)

API_BASE = "https://api.telegram.org"
BUTTON_TEXT = "I'm checking"
POLL_TIMEOUT_S = 25
AUDIENCES = ("family", "neighbour")

AckFn = Callable[[str, str, str], Any]  # (alert_id, by, name) -> alert | None


class TelegramClient:
    def __init__(self, token: str, http: httpx.Client | None = None, base: str = API_BASE):
        self._url = f"{base}/bot{token}"
        self._http = http or httpx.Client(timeout=POLL_TIMEOUT_S + 10)

    def _call(self, method: str, payload: dict[str, Any]) -> Any:
        resp = self._http.post(f"{self._url}/{method}", json=payload)
        body = resp.json()
        if not body.get("ok"):
            raise RuntimeError(f"Telegram {method} failed: {body.get('description')}")
        return body["result"]

    def send_message(self, chat_id: str, text: str, ack_data: str | None = None) -> Any:
        payload: dict[str, Any] = {"chat_id": chat_id, "text": text}
        if ack_data:
            payload["reply_markup"] = {
                "inline_keyboard": [[{"text": BUTTON_TEXT, "callback_data": ack_data}]]
            }
        return self._call("sendMessage", payload)

    def answer_callback(self, callback_query_id: str, text: str) -> Any:
        return self._call(
            "answerCallbackQuery", {"callback_query_id": callback_query_id, "text": text}
        )

    def get_updates(self, offset: int | None, timeout: int = POLL_TIMEOUT_S) -> list[dict]:
        payload: dict[str, Any] = {"timeout": timeout, "allowed_updates": ["callback_query"]}
        if offset is not None:
            payload["offset"] = offset
        return self._call("getUpdates", payload)


def ack_data(alert_id: str, audience: str) -> str:
    return f"ack:{alert_id}:{audience}"


def parse_ack_data(data: str | None) -> tuple[str, str] | None:
    parts = (data or "").split(":")
    if len(parts) == 3 and parts[0] == "ack" and parts[2] in AUDIENCES:
        return parts[1], parts[2]
    return None


def handle_update(update: dict[str, Any], ack: AckFn, client: TelegramClient | None) -> bool:
    """Turn an "I'm checking" press into an ack. True if it was one. O(1)."""
    query = update.get("callback_query") or {}
    parsed = parse_ack_data(query.get("data"))
    if parsed is None:
        return False
    alert_id, by = parsed
    name = (query.get("from") or {}).get("first_name") or by.title()
    alert = ack(alert_id, by, name)
    if client is not None and query.get("id"):
        reply = "Thank you, marked as checking." if alert else "This alert is no longer active."
        try:
            client.answer_callback(query["id"], reply)
        except Exception:
            log.exception("answerCallbackQuery failed")
    return True


MAX_TRIES = 3


class TelegramPoller:
    """Local mode: long-poll getUpdates so a button press acks within a second or two."""

    def __init__(self, client: TelegramClient, ack: AckFn) -> None:
        self._client = client
        self._ack = ack
        self._offset: int | None = None
        self._failures: dict[int, int] = {}

    def poll_once(self) -> int:
        """Handle new updates in order. The offset only moves past an update once it was
        handled (M10), so a press whose ack failed (e.g. a store error) is retried on the next
        poll; after MAX_TRIES it is skipped so one broken update can't block the queue."""
        updates = self._client.get_updates(self._offset)
        for update in updates:
            update_id = update["update_id"]
            try:
                handle_update(update, self._ack, self._client)
            except Exception:
                tries = self._failures.get(update_id, 0) + 1
                self._failures[update_id] = tries
                log.exception("Telegram update %s failed (try %d)", update_id, tries)
                if tries < MAX_TRIES:
                    break  # leave the offset here: Telegram sends it again next poll
            self._failures.pop(update_id, None)
            self._offset = update_id + 1
        return len(updates)

    async def run_forever(self) -> None:
        while True:
            try:
                await asyncio.to_thread(self.poll_once)
            except Exception:
                log.exception("Telegram getUpdates failed; retrying")
                await asyncio.sleep(5)


def webhook_router(secret: str, client_factory: Callable[[], TelegramClient | None]) -> APIRouter:
    """AWS mode: Telegram POSTs updates here (setWebhook with the same secret_token)."""
    router = APIRouter()

    @router.post("/telegram/webhook")
    async def telegram_webhook(request: Request) -> dict[str, bool]:
        got = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if not secret or not hmac.compare_digest(got, secret):
            raise HTTPException(status_code=401, detail="invalid Telegram secret")
        update = await request.json()
        escalator = request.app.state.escalator
        await run_in_threadpool(handle_update, update, escalator.ack, client_factory())
        return {"ok": True}

    return router
