from datetime import datetime, timezone

from app.core.config import settings
from app.db.memory_store import memory_admin_access
from app.db.sqlite_db import sqlite_db

ADMIN_TABS = ["Dashboard", "Verify Members", "Check-in", "Food Scanner", "Attendance", "Events", "Event Scheduler", "Invitations", "AI Analysis", "Export", "Audit Log", "Admin Access"]


def owner_emails() -> list[str]:
    return settings.admin_emails


def is_owner_admin(email: str) -> bool:
    return str(email or "").lower() in owner_emails()


def normalize_admin_tabs(tabs) -> list[str]:
    allowed = set(ADMIN_TABS)
    result = []
    for tab in tabs if isinstance(tabs, list) else []:
        if str(tab) in allowed and str(tab) not in result:
            result.append(str(tab))
    return result


async def resolve_admin_access(email: str) -> dict | None:
    normalized = str(email or "").strip().lower()
    if not normalized:
        return None
    if is_owner_admin(normalized):
        return {"email": normalized, "tabs": ADMIN_TABS, "owner": True, "active": True}
    if sqlite_db.ready():
        access = await sqlite_db.get("admin_access", normalized)
        if access and access.get("active", True):
            tabs = normalize_admin_tabs(access.get("tabs"))
            if tabs:
                return {"email": normalized, "tabs": tabs, "owner": False, "active": True}

    access = next((item for item in memory_admin_access if item.get("email") == normalized and item.get("active", True)), None)
    if not access:
        return None
    tabs = normalize_admin_tabs(access.get("tabs"))
    if not tabs:
        return None
    return {"email": normalized, "tabs": tabs, "owner": False, "active": True}


async def list_admin_access() -> list[dict]:
    owner_users = [{"email": email, "name": "Owner admin", "tabs": ADMIN_TABS, "active": True, "owner": True} for email in owner_emails()]
    if sqlite_db.ready():
        delegated = await sqlite_db.list_all("admin_access", order="desc")
        return owner_users + [{
            "email": item.get("email"),
            "name": item.get("name") or "",
            "tabs": normalize_admin_tabs(item.get("tabs")),
            "active": item.get("active", True) is not False,
            "owner": False,
            "updatedAt": item.get("updatedAt"),
            "updatedBy": item.get("updatedBy"),
        } for item in delegated]

    delegated = sorted(memory_admin_access, key=lambda item: item.get("updatedAt") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return owner_users + [{
        "email": item.get("email"),
        "name": item.get("name") or "",
        "tabs": normalize_admin_tabs(item.get("tabs")),
        "active": item.get("active", True) is not False,
        "owner": False,
        "updatedAt": item.get("updatedAt"),
        "updatedBy": item.get("updatedBy"),
    } for item in delegated]


async def upsert_admin_access(email: str, name: str, tabs: list[str], active: bool, actor: str) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    record = {"email": email, "name": str(name or "")[:80], "tabs": tabs, "active": active, "updatedBy": actor, "updatedAt": now}
    if sqlite_db.ready():
        existing = await sqlite_db.get("admin_access", email)
        if not existing:
            record["createdBy"] = actor
            record["createdAt"] = now
        else:
            record["createdBy"] = existing.get("createdBy", actor)
            record["createdAt"] = existing.get("createdAt", now)
        await sqlite_db.upsert("admin_access", email, record)
        return {**record, "tabs": normalize_admin_tabs(record.get("tabs")), "owner": False}

    user = next((item for item in memory_admin_access if item.get("email") == email), None)
    if user:
        user.update(record)
    else:
        user = {**record, "createdBy": actor, "createdAt": now}
        memory_admin_access.append(user)
    return {**user, "tabs": normalize_admin_tabs(user.get("tabs")), "owner": False}


async def deactivate_admin_access(email: str, actor: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    if sqlite_db.ready():
        existing = await sqlite_db.get("admin_access", email)
        if existing:
            existing.update({"active": False, "updatedBy": actor, "updatedAt": now})
            await sqlite_db.upsert("admin_access", email, existing)
            return

    existing = next((item for item in memory_admin_access if item.get("email") == email), None)
    if existing:
        existing.update({"active": False, "updatedBy": actor, "updatedAt": now})
