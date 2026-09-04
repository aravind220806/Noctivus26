from datetime import datetime, timezone

from app.db import mongo
from app.db.memory_store import memory_admin_sessions
from app.db.sqlite_db import sqlite_db


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def _parse(value) -> datetime | None:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
        except ValueError:
            return None
    return None


def _active(record: dict | None) -> bool:
    expires_at = _parse((record or {}).get("expiresAt"))
    return bool(expires_at and expires_at > datetime.now(timezone.utc))


async def create_session(sid: str, email: str, expires_at: datetime) -> None:
    record = {
        "sid": sid,
        "email": str(email or "").strip().lower(),
        "createdAt": _iso(datetime.now(timezone.utc)),
        "expiresAt": expires_at.astimezone(timezone.utc) if mongo.mongo_ready() else _iso(expires_at),
    }
    if mongo.mongo_ready():
        await mongo.db.admin_sessions.update_one({"sid": sid}, {"$set": record}, upsert=True)
        return
    record["expiresAt"] = _iso(expires_at)
    if sqlite_db.ready():
        await sqlite_db.upsert("admin_sessions", sid, record)
        return
    memory_admin_sessions[:] = [item for item in memory_admin_sessions if item.get("sid") != sid]
    memory_admin_sessions.append(record)


async def session_exists(sid: str) -> bool:
    clean = str(sid or "").strip()
    if not clean:
        return False
    record = None
    if mongo.mongo_ready():
        record = await mongo.db.admin_sessions.find_one({"sid": clean})
    elif sqlite_db.ready():
        record = await sqlite_db.get("admin_sessions", clean)
    else:
        record = next((item for item in memory_admin_sessions if item.get("sid") == clean), None)
    if _active(record):
        return True
    if record:
        await delete_session(clean)
    return False


async def delete_session(sid: str) -> None:
    clean = str(sid or "").strip()
    if not clean:
        return
    if mongo.mongo_ready():
        await mongo.db.admin_sessions.delete_one({"sid": clean})
        return
    if sqlite_db.ready():
        await sqlite_db.delete("admin_sessions", clean)
        return
    memory_admin_sessions[:] = [item for item in memory_admin_sessions if item.get("sid") != clean]


async def delete_sessions_for_email(email: str) -> None:
    normalized = str(email or "").strip().lower()
    if not normalized:
        return
    if mongo.mongo_ready():
        await mongo.db.admin_sessions.delete_many({"email": normalized})
        return
    if sqlite_db.ready():
        for item in await sqlite_db.list_all("admin_sessions"):
            if item.get("email") == normalized:
                await sqlite_db.delete("admin_sessions", item.get("sid"))
        return
    memory_admin_sessions[:] = [item for item in memory_admin_sessions if item.get("email") != normalized]


async def delete_all_sessions() -> None:
    if mongo.mongo_ready():
        await mongo.db.admin_sessions.delete_many({})
        return
    if sqlite_db.ready():
        await sqlite_db.delete_all("admin_sessions")
        return
    memory_admin_sessions.clear()
