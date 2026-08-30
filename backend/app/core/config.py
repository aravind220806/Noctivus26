from pathlib import Path
from typing import Any

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
load_dotenv(Path(__import__("os").environ.get("ATLAS_CREDENTIALS_FILE", ROOT.parent / "atlas-credentials.env")))


def env(name: str, default: str = "") -> str:
    import os

    return os.environ.get(name, default)


def csv_env(name: str) -> list[str]:
    return [item.strip().strip('"\'') for item in env(name).split(",") if item.strip().strip('"\'')]


class Settings:
    port = int(env("PORT", "4000"))
    environment = (env("ENVIRONMENT") or env("NODE_ENV", "development")).lower()
    node_env = environment
    mongodb_uri = env("MONGODB_URI")
    mongo_db_name = env("MONGODB_DB", "noctivus")
    mongo_max_pool_size = int(env("MONGODB_MAX_POOL_SIZE", "20"))
    mongo_min_pool_size = int(env("MONGODB_MIN_POOL_SIZE", "2"))
    mongo_server_selection_timeout_ms = int(env("MONGODB_SERVER_SELECTION_TIMEOUT_MS", "8000"))
    mongo_storage_limit_mb = max(1, int(env("MONGODB_STORAGE_LIMIT_MB", "1024")))
    web_concurrency = max(1, int(env("WEB_CONCURRENCY", "2" if environment == "production" else "1")))
    redis_url = env("REDIS_URL")
    event_capacities = {
        item.split(":", 1)[0].strip(): int(item.split(":", 1)[1])
        for item in csv_env("EVENT_CAPACITIES")
        if ":" in item and item.split(":", 1)[1].strip().isdigit()
    }
    frontend_origins = csv_env("FRONTEND_ORIGINS") or ["http://localhost:5173"]
    # Keep the development fallback convenient, but never allow a public default in production.
    admin_session_secret = env("ADMIN_SESSION_SECRET") or "development-admin-session-secret"
    google_client_id = env("GOOGLE_CLIENT_ID")
    admin_emails = [email.lower() for email in csv_env("ADMIN_EMAILS")]
    allow_memory_db = env("ALLOW_MEMORY_DB", "true" if environment != "production" else "false").lower() == "true"
    registration_open = env("REGISTRATION_OPEN").lower() == "true"
    resend_api_key = env("RESEND_API_KEY")
    confirm_from = env("CONFIRM_FROM")


settings = Settings()

if settings.environment == "production" and settings.allow_memory_db:
    raise RuntimeError("ALLOW_MEMORY_DB cannot be true in production.")

if settings.environment == "production" and not settings.mongodb_uri:
    raise RuntimeError("MONGODB_URI is required in production.")

if settings.environment == "production" and not env("ADMIN_SESSION_SECRET"):
    raise RuntimeError("ADMIN_SESSION_SECRET is required in production.")


def jsonable(value: Any) -> Any:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value
