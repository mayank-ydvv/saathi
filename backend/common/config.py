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
# Activity the engine learns from (accepted change, see docs/CONTRACTS.md): package and
# vehicle events are stored but aren't evidence the parent is up.
ENGINE_EVENT_TYPES = frozenset({"motion.human", "motion", "ding"})

DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173",  # dashboard
    "http://localhost:5174",  # parent app
    "http://localhost:5175",  # landing page
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
)

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
    # No default (M11): an unset key would accept forged Ring events. create_app refuses to start.
    ring_webhook_hmac_key: str = ""
    telegram_bot_token: str = ""
    telegram_family_chat_id: str = ""
    telegram_neighbour_chat_id: str = ""
    bedrock_model_id: str = ""
    # Off unless asked for (C3): demo mode mounts /_dev and shrinks the ladder waits.
    demo_mode: bool = False
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
    telegram_webhook_secret: str = ""
    routines_file: str = "sandbox/fixtures/routines_home-demo-1.json"
    family_name: str = "Priya"
    neighbour_name: str = "Ravi"
    # Browser origins allowed by CORS (C6); the dashboard, parent app and landing page.
    cors_origins: list[str] = field(default_factory=lambda: list(DEFAULT_CORS_ORIGINS))
    # API authentication (C1/C2). "off" for local demos; "cognito" checks the family's
    # Cognito id token and the parent tablet's device token on every data route.
    auth_mode: str = "off"
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""
    parent_device_token: str = ""
    # Who may read a home (lower-cased emails), written onto the home record by seeding.
    family_emails: list[str] = field(default_factory=list)

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
        telegram_webhook_secret=env.get("TELEGRAM_WEBHOOK_SECRET", ""),
        routines_file=env.get("ROUTINES_FILE", d.routines_file),
        family_name=env.get("FAMILY_NAME", d.family_name),
        neighbour_name=env.get("NEIGHBOUR_NAME", d.neighbour_name),
        cors_origins=_list(env.get("CORS_ORIGINS"), list(DEFAULT_CORS_ORIGINS)),
        auth_mode=env.get("AUTH_MODE", d.auth_mode).strip().lower(),
        cognito_user_pool_id=env.get("COGNITO_USER_POOL_ID", ""),
        cognito_client_id=env.get("COGNITO_CLIENT_ID", ""),
        parent_device_token=env.get("PARENT_DEVICE_TOKEN", ""),
        family_emails=[e.lower() for e in _list(env.get("FAMILY_EMAILS"), [])],
    )


def check_settings(s: Settings) -> None:
    """Refuse to start with settings that would leave the API open (M11, C1). O(1)."""
    if not s.ring_webhook_hmac_key:
        raise RuntimeError(
            "RING_WEBHOOK_HMAC_KEY is not set: refusing to accept unsigned Ring events"
        )
    if s.auth_mode not in {"off", "cognito"}:
        raise RuntimeError(f"unknown AUTH_MODE={s.auth_mode!r}; use off or cognito")
    if s.auth_mode == "cognito" and not (s.cognito_user_pool_id and s.cognito_client_id):
        raise RuntimeError("AUTH_MODE=cognito needs COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Process-wide settings, loaded once. Tests call `get_settings.cache_clear()`."""
    return load_settings()
