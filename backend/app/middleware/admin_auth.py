import base64
import hashlib
import hmac
import json
import time
from typing import Callable

from fastapi import Header, HTTPException

from app.core.config import settings
from app.services.admin_access_service import normalize_admin_tabs, resolve_admin_access

SESSION_TTL_MS = 8 * 60 * 60 * 1000


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def sign_admin_token(user: dict) -> str:
    payload = _b64encode(json.dumps({**user, "exp": int(time.time() * 1000) + SESSION_TTL_MS}, separators=(",", ":")).encode())
    signature = hmac.new(settings.admin_session_secret.encode(), payload.encode(), hashlib.sha256).digest()
    return f"{payload}.{_b64encode(signature)}"


def verify_admin_token(token: str | None) -> dict | None:
    try:
        payload, signature = str(token or "").split(".", 1)
        expected = _b64encode(hmac.new(settings.admin_session_secret.encode(), payload.encode(), hashlib.sha256).digest())
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
        }
    except Exception:
        return None


async def require_admin(authorization: str | None = Header(default=None)) -> dict:
    provided = str(authorization or "").replace("Bearer ", "", 1).replace("bearer ", "", 1)
    admin = verify_admin_token(provided)
    if not admin:
        raise HTTPException(status_code=401, detail="Admin authorization required.")
    access = await resolve_admin_access(admin.get("email"))
    if not access:
        raise HTTPException(status_code=403, detail="This admin account no longer has access.")
    return {**admin, "tabs": access["tabs"], "owner": access["owner"]}


def require_admin_tab(tab: str) -> Callable:
    async def dependency(authorization: str | None = Header(default=None)) -> dict:
        admin = await require_admin(authorization)
        if tab not in (admin.get("tabs") or []):
            raise HTTPException(status_code=403, detail=f"{tab} access required.")
        return admin

    return dependency


def require_any_admin_tab(tabs: list[str]) -> Callable:
    async def dependency(authorization: str | None = Header(default=None)) -> dict:
        admin = await require_admin(authorization)
        if not any(tab in (admin.get("tabs") or []) for tab in tabs):
            raise HTTPException(status_code=403, detail="This admin action is not allowed for your account.")
        return admin

    return dependency

