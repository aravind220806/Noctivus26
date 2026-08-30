from datetime import datetime, timezone

from app.core.config import settings
from app.db.memory_store import memory_admin_access
from app.db import mongo

ADMIN_TABS = ["Dashboard", "Verify Members", "Check-in", "Events", "Event Scheduler", "Invitations", "Announcements", "AI Analysis", "Export", "Audit Log", "Admin Access"]


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
    try:
        if mongo.mongo_ready():
            access = await mongo.db.admin_access.find_one({"email": normalized, "active": True})
            if access is not None:
                tabs = normalize_admin_tabs(access.get("tabs"))
                if tabs:
                    return {"email": normalized, "tabs": tabs, "owner": False, "active": True}
    except Exception as error:
        print(f"Mongo admin access lookup failed; using memory fallback: {error}")
        mongo.client = None
        mongo.db = None
    access = next((item for item in memory_admin_access if item.get("email") == normalized and item.get("active", True)), None)
    if not access:
        return None
    tabs = normalize_admin_tabs(access.get("tabs"))
    if not tabs:
        return None
    return {"email": normalized, "tabs": tabs, "owner": False, "active": True}


async def list_admin_access() -> list[dict]:
    owner_users = [{"email": email, "name": "Owner admin", "tabs": ADMIN_TABS, "active": True, "owner": True} for email in owner_emails()]
    try:
        if mongo.mongo_ready():
            delegated = await mongo.db.admin_access.find({}).sort("updatedAt", -1).to_list(length=1000)
            return owner_users + [{
                "email": item.get("email"),
                "name": item.get("name") or "",
                "tabs": normalize_admin_tabs(item.get("tabs")),
                "active": item.get("active", True) is not False,
                "owner": False,
                "updatedAt": item.get("updatedAt"),
                "updatedBy": item.get("updatedBy"),
            } for item in delegated]
    except Exception as error:
        print(f"Mongo admin access list failed; using memory fallback: {error}")
        mongo.client = None
        mongo.db = None
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
    now = datetime.now(timezone.utc)
    record = {"email": email, "name": str(name or "")[:80], "tabs": tabs, "active": active, "updatedBy": actor, "updatedAt": now}
    try:
        if mongo.mongo_ready():
            await mongo.db.admin_access.update_one({"email": email}, {"$set": record, "$setOnInsert": {"createdBy": actor, "createdAt": now}}, upsert=True)
            user = await mongo.db.admin_access.find_one({"email": email})
            return {**user, "tabs": normalize_admin_tabs(user.get("tabs")), "owner": False}
    except Exception as error:
        print(f"Mongo admin access save failed; using memory fallback: {error}")
        mongo.client = None
        mongo.db = None
    user = next((item for item in memory_admin_access if item.get("email") == email), None)
    if user:
        user.update(record)
    else:
        user = {**record, "createdBy": actor, "createdAt": now}
        memory_admin_access.append(user)
    return {**user, "tabs": normalize_admin_tabs(user.get("tabs")), "owner": False}


async def deactivate_admin_access(email: str, actor: str) -> None:
    try:
        if mongo.mongo_ready():
            await mongo.db.admin_access.update_one({"email": email}, {"$set": {"active": False, "updatedBy": actor, "updatedAt": datetime.now(timezone.utc)}})
            return
    except Exception as error:
        print(f"Mongo admin access deletion failed; using memory fallback: {error}")
        mongo.client = None
        mongo.db = None
    existing = next((item for item in memory_admin_access if item.get("email") == email), None)
    if existing:
        existing.update({"active": False, "updatedBy": actor, "updatedAt": datetime.now(timezone.utc)})
