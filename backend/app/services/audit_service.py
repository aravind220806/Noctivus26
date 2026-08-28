from datetime import datetime, timezone
import re

from app.db.memory_store import memory_admin_actions
from app.db import mongo


async def record_admin_action(actor: str, action: str, target: str = "", metadata: dict | None = None) -> None:
    compact_metadata = {str(key): str(value)[:300] for key, value in (metadata or {}).items()}
    record = {"actor": actor[:160], "action": action[:80], "target": target[:240], "metadata": compact_metadata, "createdAt": datetime.now(timezone.utc)}
    if mongo.mongo_ready():
        await mongo.db.admin_actions.insert_one(record)
    else:
        memory_admin_actions.insert(0, record)
        del memory_admin_actions[500:]


async def list_admin_actions(search: str = "", limit: int = 200) -> list[dict]:
    if mongo.mongo_ready():
        query = {}
        if search:
            term = re.escape(search[:80])
            query = {"$or": [{"actor": {"$regex": term, "$options": "i"}}, {"action": {"$regex": term, "$options": "i"}}, {"target": {"$regex": term, "$options": "i"}}]}
        return await mongo.db.admin_actions.find(query, {"_id": 0}).sort("createdAt", -1).to_list(length=limit)
    rows = memory_admin_actions
    if search:
        value = search.lower()
        rows = [row for row in rows if value in f"{row.get('actor')} {row.get('action')} {row.get('target')}".lower()]
    return rows[:limit]
