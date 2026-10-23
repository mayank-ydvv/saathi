"""Spoken nudge for the parent app via Amazon Polly, cached by text hash in the blob store.

Only the blob *key* is cached in memory; the URL is made per request, because on S3 it is a
presigned URL that expires after an hour (H7).

Voice: "Kajal", neural, en-IN (bilingual en-IN/hi-IN, so LanguageCode is required).
Verified against the Polly "Available voices" table. Without AWS credentials (local dev) or
when Polly fails, a pre-recorded clip in `assets/` is served instead.
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from threading import Lock
from typing import Any

import boto3
from botocore.config import Config

from backend.common.store import Store

log = logging.getLogger(__name__)

VOICE_ID = "Kajal"
ENGINE = "neural"
LANGUAGE_CODE = "en-IN"
FALLBACK_FILE = Path(__file__).parent / "assets" / "nudge_fallback.m4a"
FALLBACK_KEY = "audio/nudge-fallback.m4a"


def audio_key(text: str) -> str:
    return f"audio/nudge-{hashlib.sha256(text.encode()).hexdigest()[:16]}.mp3"


class Voice:
    def __init__(self, store: Store, polly: Any = None, region: str = "us-east-1") -> None:
        self._store = store
        self._polly = polly
        self._region = region
        self._keys: dict[str, str] = {}  # text -> stored blob key, so repeat polls are O(1)
        self._lock = Lock()

    def _client(self) -> Any | None:
        if self._polly is None:
            session = boto3.Session(region_name=self._region)
            if session.get_credentials() is None:
                return None
            self._polly = session.client(
                "polly",
                config=Config(connect_timeout=2, read_timeout=5, retries={"max_attempts": 1}),
            )
        return self._polly

    def synthesize(self, text: str) -> bytes | None:
        """MP3 bytes from Polly, or None if unavailable."""
        client = self._client()
        if client is None:
            return None
        try:
            resp = client.synthesize_speech(
                Text=text,
                OutputFormat="mp3",
                VoiceId=VOICE_ID,
                Engine=ENGINE,
                LanguageCode=LANGUAGE_CODE,
            )
            return resp["AudioStream"].read()
        except Exception:
            log.exception("Polly synthesize_speech failed; using the fallback clip")
            return None

    def ensure(self, text: str) -> str | None:
        """Blob key of the spoken `text` (cache -> blob store -> Polly), or None if Polly is
        unavailable. O(1) once cached."""
        with self._lock:
            if text in self._keys:
                return self._keys[text]
            key = audio_key(text)
            if self._store.get_blob(key) is None:
                mp3 = self.synthesize(text)
                if mp3 is None:
                    return None  # not cached: retry Polly on the next nudge
                self._store.save_blob(key, mp3, "audio/mpeg")
            self._keys[text] = key
            return key

    def audio_url(self, text: str) -> str:
        """A fresh URL for the spoken `text`, or for the fallback clip."""
        key = self.ensure(text)
        return self._store.blob_url(key) if key is not None else self._fallback_url()

    def _fallback_url(self) -> str:
        if self._store.get_blob(FALLBACK_KEY) is None:
            self._store.save_blob(FALLBACK_KEY, FALLBACK_FILE.read_bytes(), "audio/mp4")
        return self._store.blob_url(FALLBACK_KEY)
