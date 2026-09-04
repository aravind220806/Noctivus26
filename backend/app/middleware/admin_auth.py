import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Callable

from fastapi import Cookie, HTTPException, Request

from app.core.config import settings
from app.services.admin_access_service import normalize_admin_tabs, resolve_admin_access
from app.services.admin_session_service import session_exists

SESSION_TTL_MS = 8 * 60 * 60 * 1000
_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def sign_admin_token(user: dict) -> tuple[str, str]:
    """Return (signed_token, csrf_token). csrf_token must be included in the login response body."""
    csrf = secrets.token_hex(16)
    sid = secrets.token_urlsafe(16)
    payload = _b64encode(
        json.dumps(
            {**user, "sid": sid, "exp": int(time.time() * 1000) + SESSION_TTL_MS, "csrf": csrf},
            separators=(",", ":"),
        ).encode()
    )
    sig = hmac.new(settings.admin_session_secret.encode(), payload.encode(), hashlib.sha256).digest()
    return f"{payload}.{_b64encode(sig)}", csrf


def verify_admin_token(token: str | None) -> dict | None:
    try:
        payload, signature = str(token or "").split(".", 1)
        expected = _b64encode(
            hmac.new(settings.admin_session_secret.encode(), payload.encode(), hashlib.sha256).digest()
        )
        if not hmac.compare_digest(signature, expected):
            return None
        data = json.loads(_b64decode(payload).decode())
        if not data.get("exp") or int(time.time() * 1000) > data["exp"]:
            return None
        return {
            "email": data.get("email"),
            "name": data.get("name"),
            "picture": data.get("picture"),
            "tabs": normalize_admin_tabs(data.get("tabs")),
            "owner": data.get("owner") is True,
            "csrf": data.get("csrf"),
            "sid": data.get("sid"),
            "exp": data.get("exp"),
        }
    except Exception:
        return None


async def _resolve_admin(
    request: Request,
    noctivus_admin_session: str | None,
) -> dict:
    admin = verify_admin_token(noctivus_admin_session)
    if not admin:
        raise HTTPException(status_code=401, detail="Admin authorization required.")
    if not await session_exists(admin.get("sid")):
        raise HTTPException(status_code=401, detail="Session revoked.")
    access = await resolve_admin_access(admin.get("email"))
    if not access:
        raise HTTPException(status_code=403, detail="This admin account no longer has access.")
    result = {**admin, "tabs": access["tabs"], "owner": access["owner"]}
    if request.method not in _SAFE_METHODS:
        csrf_header = request.headers.get("x-csrf-token", "")
        expected_csrf = result.get("csrf") or ""
        if not expected_csrf or not hmac.compare_digest(csrf_header, expected_csrf):
            raise HTTPException(status_code=403, detail="CSRF token missing or invalid.")
    return result


async def require_admin(
    request: Request,
    noctivus_admin_session: str | None = Cookie(default=None),
) -> dict:
    return await _resolve_admin(request, noctivus_admin_session)


def require_admin_tab(tab: str) -> Callable:
    async def dependency(
        request: Request,
        noctivus_admin_session: str | None = Cookie(default=None),
    ) -> dict:
        admin = await _resolve_admin(request, noctivus_admin_session)
        if tab not in (admin.get("tabs") or []):
            raise HTTPException(status_code=403, detail=f"{tab} access required.")
        return admin

    return dependency


def require_any_admin_tab(tabs: list[str]) -> Callable:
    async def dependency(
        request: Request,
        noctivus_admin_session: str | None = Cookie(default=None),
    ) -> dict:
        admin = await _resolve_admin(request, noctivus_admin_session)
        if not any(tab in (admin.get("tabs") or []) for tab in tabs):
            raise HTTPException(status_code=403, detail="This admin action is not allowed for your account.")
        return admin

    return dependency
