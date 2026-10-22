"""Typed settings loaded from the environment (and `.env` when present), plus shared constants.

Constants come from contract 4.1; env var names from contract 4.7. Extra optional variables
(not in `.env.example`) are documented in docs/BACKEND.md.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache

from dotenv import load_dotenv

DEMO_HOME_ID = "home-demo-1"
TIMEZONE = "Asia/Kolkata"
ZONES: tuple[str, ...] = ("front_door", "kitchen", "living_room", "bedroom")
SLOTS_PER_DAY = 96
SLOT_MINUTES = 15
HISTORY_DAYS = 14
ENGINE_EVENT_TYPES = frozenset({"motion.human", "motion", "ding", "package", "vehicle"})

# Short ladder waits used when DEMO_MODE=true (contract 4.4: 10–20 s each).
DEMO_WAITS = {"SUSPECT": 10, "NUDGE_PARENT": 15, "ALERT_FAMILY": 20}


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _int(value: str | None, default: int) -> int:
    try:
        return int(value) if value not in (None, "") else default
    except ValueError:
        return default


def _list(value: str | None, default: list[str]) -> list[str]:
    items = [v.strip() for v in (value or "").split(",") if v.strip()]
    return items or default


@dataclass(frozen=True, slots=True)
class Settings:
    storage: str = "memory"
    aws_region: str = "us-east-1"
    ring_api_base: str = "http://localhost:8787"
    ring_token: str = "dummy"
    ring_webhook_hmac_key: str = "change-me"
    telegram_bot_token: str = ""
    telegram_family_chat_id: str = ""
    telegram_neighbour_chat_id: str = ""
    bedrock_model_id: str = ""
    demo_mode: bool = True
    esc_wait_suspect: int = 300
    esc_wait_nudge: int = 300
    esc_wait_family: int = 600
    tick_seconds: int = 60
    # Optional extras (docs/BACKEND.md).
    home_ids: list[str] = field(default_factory=lambda: [DEMO_HOME_ID])
    demo_clock_start: str = ""
    visitor_descriptions: bool = True
    table_prefix: str = ""
    blob_bucket: str = ""
    sns_topic_arn: str = ""
    escalator: str = "local"
    state_machine_arn: str = ""
    public_base_url: str = "http://localhost:8000"
    telegram_mode: str = "poll"
    routines_file: str = "sandbox/fixtures/routines_home-demo-1.json"
    family_name: str = "Priya"
    neighbour_name: str = "Ravi"

    @property
    def waits(self) -> dict[str, int]:
        """Seconds to stay in each ladder state before moving on."""
        if self.demo_mode:
            return dict(DEMO_WAITS)
        return {
            "SUSPECT": self.esc_wait_suspect,
            "NUDGE_PARENT": self.esc_wait_nudge,
            "ALERT_FAMILY": self.esc_wait_family,
        }

    def table(self, name: str) -> str:
        """Physical DynamoDB table name for a logical one, e.g. "events" -> "saathi-events"."""
        return f"{self.table_prefix}saathi-{name}"


def load_settings(env: dict[str, str] | None = None) -> Settings:
    """Build Settings from `env` (defaults to os.environ after loading `.env`)."""
    if env is None:
        load_dotenv(override=False)
        env = dict(os.environ)
    d = Settings()
    return Settings(
        storage=env.get("STORAGE", d.storage).strip().lower(),
        aws_region=env.get("AWS_REGION", d.aws_region),
        ring_api_base=env.get("RING_API_BASE", d.ring_api_base).rstrip("/"),
        ring_token=env.get("RING_TOKEN", d.ring_token),
        ring_webhook_hmac_key=env.get("RING_WEBHOOK_HMAC_KEY", d.ring_webhook_hmac_key),
        telegram_bot_token=env.get("TELEGRAM_BOT_TOKEN", ""),
        telegram_family_chat_id=env.get("TELEGRAM_FAMILY_CHAT_ID", ""),
        telegram_neighbour_chat_id=env.get("TELEGRAM_NEIGHBOUR_CHAT_ID", ""),
        bedrock_model_id=env.get("BEDROCK_MODEL_ID", ""),
        demo_mode=_bool(env.get("DEMO_MODE"), d.demo_mode),
        esc_wait_suspect=_int(env.get("ESC_WAIT_SUSPECT"), d.esc_wait_suspect),
        esc_wait_nudge=_int(env.get("ESC_WAIT_NUDGE"), d.esc_wait_nudge),
        esc_wait_family=_int(env.get("ESC_WAIT_FAMILY"), d.esc_wait_family),
        tick_seconds=_int(env.get("TICK_SECONDS"), d.tick_seconds),
        home_ids=_list(env.get("HOME_IDS"), [DEMO_HOME_ID]),
        demo_clock_start=env.get("DEMO_CLOCK_START", ""),
        visitor_descriptions=_bool(env.get("VISITOR_DESCRIPTIONS"), d.visitor_descriptions),
        table_prefix=env.get("TABLE_PREFIX", ""),
        blob_bucket=env.get("BLOB_BUCKET", ""),
        sns_topic_arn=env.get("SNS_TOPIC_ARN", ""),
        escalator=env.get("ESCALATOR", d.escalator).strip().lower(),
        state_machine_arn=env.get("STATE_MACHINE_ARN", ""),
        public_base_url=env.get("PUBLIC_BASE_URL", d.public_base_url).rstrip("/"),
        telegram_mode=env.get("TELEGRAM_MODE", d.telegram_mode).strip().lower(),
        routines_file=env.get("ROUTINES_FILE", d.routines_file),
        family_name=env.get("FAMILY_NAME", d.family_name),
        neighbour_name=env.get("NEIGHBOUR_NAME", d.neighbour_name),
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Process-wide settings, loaded once. Tests call `get_settings.cache_clear()`."""
    return load_settings()
