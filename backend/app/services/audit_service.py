from datetime import datetime, timezone

from app.db.memory_store import memory_admin_actions
from app.db import mongo
from app.db.sqlite_db import sqlite_db


def _format_action(doc: dict) -> dict:
    item = dict(doc)
    item.pop("_id", None)
    if isinstance(item.get("createdAt"), datetime):
        item["createdAt"] = item["createdAt"].isoformat()
    return item


async def record_admin_action(actor: str, action: str, target: str = "", metadata: dict | None = None) -> None:
    compact_metadata = {}
    if metadata:
        for k, v in metadata.items():
            if v is not None:
                compact_metadata[str(k)] = str(v)[:300]

    record = {
        "actor": str(actor or "system")[:160],
        "action": str(action or "unknown")[:80],
        "target": str(target or "")[:240],
        "metadata": compact_metadata,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    if mongo.mongo_ready():
        try:
            await mongo.db.admin_actions.insert_one(dict(record))
            return
        except Exception as error:
            print(f"Mongo admin action logging failed: {error}")

    if sqlite_db.ready():
        try:
            await sqlite_db.insert_action(record)
            return
        except Exception as error:
            print(f"SQLite admin action logging failed: {error}")

    # Memory fallback
    memory_admin_actions.insert(0, record)
    del memory_admin_actions[1000:]


async def list_admin_actions(search: str = "", limit: int = 500) -> list[dict]:
    import re as _re
    if mongo.mongo_ready():
        try:
            query = {}
            if search:
                term = _re.escape(search.strip()[:80])
                query = {
                    "$or": [
                        {"actor": {"$regex": term, "$options": "i"}},
                        {"action": {"$regex": term, "$options": "i"}},
                        {"target": {"$regex": term, "$options": "i"}},
                    ]
                }
            docs = await mongo.db.admin_actions.find(query).sort("createdAt", -1).to_list(length=limit)
            return [_format_action(d) for d in docs]
        except Exception as error:
            print(f"Mongo admin action list failed: {error}")

    if sqlite_db.ready():
        try:
            return [_format_action(r) for r in await sqlite_db.list_actions(search=search, limit=limit)]
        except Exception as error:
            print(f"SQLite admin action list failed: {error}")

    rows = memory_admin_actions
    if search:
        val = search.strip().lower()
        rows = [
            r for r in rows
            if val in f"{r.get('actor', '')} {r.get('action', '')} {r.get('target', '')} {r.get('metadata', '')}".lower()
        ]
    return [_format_action(r) for r in rows[:limit]]
