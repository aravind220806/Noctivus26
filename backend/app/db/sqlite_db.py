"""SQLite-backed persistence layer.

All records are stored as JSON blobs inside a simple key/value-ish table so
the existing dict-based service interfaces need zero structural changes.

Tables
------
  registrations   – keyed by ``registrationId``
  events          – keyed by ``id``
  admin_access    – keyed by ``email``
  admin_actions   – append-only audit log
  event_slots     – keyed by ``id``

Usage
-----
  from app.db.sqlite_db import sqlite_db

  await sqlite_db.init()                          # call once at startup
  row = await sqlite_db.get("registrations", "NOC26-AABBCC")
  await sqlite_db.upsert("registrations", "NOC26-AABBCC", record)
  rows = await sqlite_db.list_all("registrations")
"""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiosqlite

logger = logging.getLogger(__name__)

# Default DB location: backend/noctivus.db (next to app/ directory)
_DEFAULT_DB_PATH = Path(__file__).resolve().parents[3] / "noctivus.db"
DB_PATH = Path(os.environ.get("SQLITE_DB_PATH", str(_DEFAULT_DB_PATH)))

_TABLES = [
    "registrations",
    "events",
    "admin_access",
    "event_slots",
]


def _dumps(obj: Any) -> str:
    """Serialize a dict to JSON, converting datetime objects to ISO strings."""
    def _default(v: Any) -> Any:
        if isinstance(v, datetime):
            return v.isoformat()
        raise TypeError(f"Object of type {type(v).__name__} is not JSON serializable")
    return json.dumps(obj, default=_default)


def _loads(raw: str | None) -> dict:
    return json.loads(raw) if raw else {}


class _SQLiteDB:
    """Minimal async SQLite wrapper used as a MongoDB-compatible fallback."""

    _ready: bool = False

    async def init(self) -> None:
        """Create tables if they don't exist. Call once at startup."""
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        try:
            async with aiosqlite.connect(DB_PATH) as db:
                # Enable WAL mode for better concurrent access
                await db.execute("PRAGMA journal_mode=WAL")
                # Performance pragmas
                await db.execute("PRAGMA synchronous=NORMAL")
                await db.execute("PRAGMA cache_size=-64000")  # 64MB cache

                # Create/verify tables
                for table in _TABLES:
                    if table == "registrations":
                        # Check if the column we need exists; add it if not
                        async with db.execute("PRAGMA table_info(registrations)") as cur:
                            columns = {row[1] for row in await cur.fetchall()}
                        if "qrHash" not in columns:
                            await db.execute("ALTER TABLE registrations ADD COLUMN qrHash TEXT")
                            logger.info("Added qrHash column to registrations table")
                        if "qrToken" not in columns:
                            await db.execute("ALTER TABLE registrations ADD COLUMN qrToken TEXT")
                            logger.info("Added qrToken column to registrations table")
                        if "paymentStatus" not in columns:
                            await db.execute("ALTER TABLE registrations ADD COLUMN paymentStatus TEXT")
                            logger.info("Added paymentStatus column to registrations table")
                        if "checkedIn" not in columns:
                            await db.execute("ALTER TABLE registrations ADD COLUMN checkedIn INTEGER DEFAULT 0")
                            logger.info("Added checkedIn column to registrations table")
                        if "normalizedUtr" not in columns:
                            await db.execute("ALTER TABLE registrations ADD COLUMN normalizedUtr TEXT")
                            logger.info("Added normalizedUtr column to registrations table")
                    await db.execute(f"""CREATE TABLE IF NOT EXISTS {table} (
                        key     TEXT PRIMARY KEY,
                        data    TEXT NOT NULL,
                        updated REAL NOT NULL DEFAULT (unixepoch('now'))
                    )""")

                # Create indexes on the frequently queried columns
                try:
                    await db.execute("CREATE INDEX IF NOT EXISTS idx_registrations_qrHash ON registrations(qrHash)")
                except Exception:
                    logger.warning("Could not create idx_registrations_qrHash index")
                try:
                    await db.execute("CREATE INDEX IF NOT EXISTS idx_registrations_qrToken ON registrations(qrToken)")
                except Exception:
                    logger.warning("Could not create idx_registrations_qrToken index")
                try:
                    await db.execute("CREATE INDEX IF NOT EXISTS idx_registrations_paymentStatus ON registrations(paymentStatus)")
                except Exception:
                    logger.warning("Could not create idx_registrations_paymentStatus index")
                try:
                    await db.execute("CREATE INDEX IF NOT EXISTS idx_registrations_checkedIn ON registrations(checkedIn)")
                except Exception:
                    logger.warning("Could not create idx_registrations_checkedIn index")
                try:
                    await db.execute("CREATE INDEX IF NOT EXISTS idx_registrations_normalizedUtr ON registrations(normalizedUtr)")
                except Exception:
                    logger.warning("Could not create idx_registrations_normalizedUtr index")
                try:
                    await db.execute("CREATE INDEX IF NOT EXISTS idx_registrations_compound_checkin ON registrations(qrHash, qrToken, paymentStatus, checkedIn)")
                except Exception:
                    logger.warning("Could not create idx_registrations_compound_checkin index")
                try:
                    await db.execute("CREATE INDEX IF NOT EXISTS idx_registrations_compound_food ON registrations(paymentStatus, key)")
                except Exception:
                    logger.warning("Could not create idx_registrations_compound_food index")

                await db.commit()
            self._ready = True
            logger.info("SQLite database ready at %s", DB_PATH)
        except Exception as exc:
            logger.error("SQLite init failed: %s", exc)
            self._ready = False

    def ready(self) -> bool:
        return self._ready

    # ── Generic KV operations ──────────────────────────────────────────────────

    async def get(self, table: str, key: str) -> dict | None:
        if not self._ready:
            return None
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute(f"SELECT data FROM {table} WHERE key=?", (key,)) as cur:
                row = await cur.fetchone()
                return _loads(row[0]) if row else None

    async def upsert(self, table: str, key: str, data: dict) -> None:
        if not self._ready:
            return
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                f"INSERT INTO {table}(key, data, updated) VALUES(?,?,unixepoch('now')) "
                f"ON CONFLICT(key) DO UPDATE SET data=excluded.data, updated=excluded.updated",
                (key, _dumps(data)),
            )
            await db.commit()

    async def delete(self, table: str, key: str) -> bool:
        if not self._ready:
            return False
        async with aiosqlite.connect(DB_PATH) as db:
            cur = await db.execute(f"DELETE FROM {table} WHERE key=?", (key,))
            await db.commit()
            return (cur.rowcount or 0) > 0

    async def delete_all(self, table: str) -> None:
        if not self._ready:
            return
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(f"DELETE FROM {table}")
            await db.commit()

    async def list_all(self, table: str, order: str = "asc") -> list[dict]:
        """Return all rows for *table*."""
        if not self._ready:
            return []
        direction = "ASC" if order.lower() == "asc" else "DESC"
        async with aiosqlite.connect(DB_PATH) as db:
            try:
                async with db.execute(f"SELECT data FROM {table} ORDER BY updated {direction}") as cur:
                    rows = await cur.fetchall()
                    return [_loads(r[0]) for r in rows]
            except Exception:
                async with db.execute(f"SELECT data FROM {table}") as cur:
                    rows = await cur.fetchall()
                    return [_loads(r[0]) for r in rows]

    async def find_one(self, table: str, field: str, value: Any) -> dict | None:
        """Return the first record where record[field] == value."""
        rows = await self.list_all(table)
        for row in rows:
            if row.get(field) == value:
                return row
        return None

    # ── Audit log ──────────────────────────────────────────────────────────────

    async def insert_action(self, record: dict) -> None:
        if not self._ready:
            return
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                "INSERT INTO admin_actions(data, ts) VALUES(?, unixepoch('now'))",
                (_dumps(record),),
            )
            await db.commit()

    async def list_actions(self, search: str = "", limit: int = 500) -> list[dict]:
        if not self._ready:
            return []
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute(
                "SELECT data FROM admin_actions ORDER BY ts DESC LIMIT ?", (limit,)
            ) as cur:
                rows = await cur.fetchall()
        results = [_loads(r[0]) for r in rows]
        if search:
            val = search.strip().lower()
            results = [
                r for r in results
                if val in f"{r.get('actor','')} {r.get('action','')} {r.get('target','')} {r.get('metadata', '')}".lower()
            ]
        return results


# Module-level singleton
sqlite_db = _SQLiteDB()