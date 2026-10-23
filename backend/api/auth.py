"""API authentication (fixes C1/C2 in docs/ERRORS.md).

Two kinds of caller:
- **Family** (dashboard): `Authorization: Bearer <Cognito id token>`. The token's RS256
  signature is checked against the user pool's JWKS, plus issuer, audience (app client id),
  `token_use == "id"` and expiry. Then the token's email must be on the home's
  `family_emails` list, so signing up alone gives no access to anyone's parent.
- **Parent tablet** (parent app): `X-Device-Token: <PARENT_DEVICE_TOKEN>`, for the nudge and
  the parent's own "I'm okay".

With AUTH_MODE=off (local demos) every check passes. Expiry uses the real clock, never the
demo clock. JWKS are fetched once per process and refreshed when an unknown `kid` appears.
"""

from __future__ import annotations

import base64
import json
import secrets
import time
from dataclasses import dataclass
from threading import Lock
from typing import Any

import httpx
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey, RSAPublicNumbers
from fastapi import HTTPException, Request

from backend.common.config import Settings

LEEWAY_S = 60


class AuthError(Exception):
    pass


def _b64(part: str) -> bytes:
    return base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))


def _int(part: str) -> int:
    return int.from_bytes(_b64(part), "big")


class CognitoVerifier:
    """Verifies Cognito id tokens. `fetch_jwks` is injectable for tests."""

    def __init__(self, region: str, user_pool_id: str, client_id: str, fetch_jwks=None) -> None:
        self.issuer = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"
        self.client_id = client_id
        self._fetch = fetch_jwks or self._fetch_http
        self._keys: dict[str, RSAPublicKey] = {}
        self._lock = Lock()

    def _fetch_http(self) -> dict[str, Any]:
        resp = httpx.get(f"{self.issuer}/.well-known/jwks.json", timeout=5)
        resp.raise_for_status()
        return resp.json()

    def _key(self, kid: str) -> RSAPublicKey:
        with self._lock:
            if kid not in self._keys:
                for k in self._fetch().get("keys", []):
                    if k.get("kty") == "RSA":
                        self._keys[k["kid"]] = RSAPublicNumbers(
                            _int(k["e"]), _int(k["n"])
                        ).public_key()
            key = self._keys.get(kid)
        if key is None:
            raise AuthError("unknown signing key")
        return key

    def verify(self, token: str, now: float | None = None) -> dict[str, Any]:
        """Claims of a valid id token, or AuthError. O(1) after the first JWKS fetch."""
        try:
            head_b64, body_b64, sig_b64 = token.split(".")
            header = json.loads(_b64(head_b64))
            claims = json.loads(_b64(body_b64))
            signature = _b64(sig_b64)
        except (ValueError, json.JSONDecodeError) as exc:
            raise AuthError("malformed token") from exc
        if header.get("alg") != "RS256":
            raise AuthError("unexpected algorithm")
        try:
            self._key(str(header.get("kid"))).verify(
                signature, f"{head_b64}.{body_b64}".encode(), padding.PKCS1v15(), hashes.SHA256()
            )
        except InvalidSignature as exc:
            raise AuthError("bad signature") from exc
        now = time.time() if now is None else now
        if claims.get("iss") != self.issuer:
            raise AuthError("wrong issuer")
        if claims.get("aud") != self.client_id or claims.get("token_use") != "id":
            raise AuthError("not an id token for this app")
        if float(claims.get("exp", 0)) + LEEWAY_S < now:
            raise AuthError("token expired")
        return claims


@dataclass(frozen=True, slots=True)
class Caller:
    kind: str  # "family" | "parent" | "anyone" (AUTH_MODE=off)
    email: str = ""
    name: str = ""


ANYONE = Caller("anyone")


class Auth:
    def __init__(self, settings: Settings, verifier: CognitoVerifier | None = None) -> None:
        self.settings = settings
        self.enabled = settings.auth_mode == "cognito"
        self.verifier = verifier
        if self.enabled and verifier is None:
            self.verifier = CognitoVerifier(
                settings.aws_region, settings.cognito_user_pool_id, settings.cognito_client_id
            )

    def family(self, request: Request) -> Caller | None:
        """The family member behind a valid bearer token, None if there is no token."""
        header = request.headers.get("authorization", "")
        if not header.lower().startswith("bearer "):
            return None
        assert self.verifier is not None
        try:
            claims = self.verifier.verify(header[7:].strip())
        except AuthError as exc:
            raise HTTPException(status_code=401, detail=f"invalid token: {exc}") from exc
        return Caller("family", str(claims.get("email", "")).lower(), str(claims.get("name", "")))

    def is_parent_device(self, request: Request) -> bool:
        token = self.settings.parent_device_token
        given = request.headers.get("x-device-token", "")
        return bool(token) and secrets.compare_digest(given.encode(), token.encode())


def _auth(request: Request) -> Auth:
    return request.app.state.auth


def may_read(home: dict[str, Any], caller: Caller) -> bool:
    allowed = {e.lower() for e in home.get("family_emails") or []}
    return caller.kind == "anyone" or (caller.kind == "family" and caller.email in allowed)


def require_family(request: Request, home: dict[str, Any]) -> Caller:
    """A family member allowed on this home (401 without a token, 403 for another home)."""
    auth = _auth(request)
    if not auth.enabled:
        return ANYONE
    caller = auth.family(request)
    if caller is None:
        raise HTTPException(status_code=401, detail="sign in required")
    if not may_read(home, caller):
        raise HTTPException(status_code=403, detail="not a member of this home")
    return caller


def require_family_or_parent(request: Request, home: dict[str, Any]) -> Caller:
    """The parent tablet (device token) or an allowed family member."""
    auth = _auth(request)
    if not auth.enabled:
        return ANYONE
    if auth.is_parent_device(request):
        return Caller("parent")
    return require_family(request, home)
