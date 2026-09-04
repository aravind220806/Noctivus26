from pathlib import Path
from typing import Any
import secrets

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
    mongo_max_pool_size = int(env("MONGODB_MAX_POOL_SIZE", "350"))
    mongo_min_pool_size = int(env("MONGODB_MIN_POOL_SIZE", "50"))
    mongo_server_selection_timeout_ms = int(env("MONGODB_SERVER_SELECTION_TIMEOUT_MS", "5000"))
    mongo_storage_limit_mb = max(1, int(env("MONGODB_STORAGE_LIMIT_MB", "1024")))
    web_concurrency = max(1, int(env("WEB_CONCURRENCY", "4" if environment == "production" else "1")))
    redis_url = env("REDIS_URL")
    forwarded_allow_ips = env("FORWARDED_ALLOW_IPS", "*")
    enable_unprefixed_routes = env("ENABLE_UNPREFIXED_ROUTES", "false").lower() == "true"
    public_self_checkin_enabled = env("PUBLIC_SELF_CHECKIN_ENABLED", "false").lower() == "true"
    event_capacities = {
        item.split(":", 1)[0].strip(): int(item.split(":", 1)[1])
        for item in csv_env("EVENT_CAPACITIES")
        if ":" in item and item.split(":", 1)[1].strip().isdigit()
    }
    frontend_origins = csv_env("FRONTEND_ORIGINS") or [
        "https://noctivus26.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4000",
        "http://127.0.0.1:4000",
    ]
    # Keep development convenient with a per-process secret; production is validated below.
    admin_session_secret = env("ADMIN_SESSION_SECRET") or secrets.token_urlsafe(48)
    google_client_id = env("GOOGLE_CLIENT_ID")
    admin_emails = [email.lower() for email in csv_env("ADMIN_EMAILS")]
    allow_memory_db = env("ALLOW_MEMORY_DB", "true" if environment != "production" else "false").lower() == "true"
    registration_open = env("REGISTRATION_OPEN").lower() == "true"
    resend_api_key = env("RESEND_API_KEY")
    confirm_from = env("CONFIRM_FROM")
    smtp_host = env("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(env("SMTP_PORT", "465"))
    smtp_user = env("SMTP_USER", "noctivus2026@gmail.com")
    smtp_password = env("SMTP_PASSWORD", "")
    smtp_from_email = env("SMTP_FROM_EMAIL", "noctivus2026@gmail.com")
    # Google Sheets Live Sync Configuration
    google_sheets_spreadsheet_id = env("GOOGLE_SHEETS_SPREADSHEET_ID")
    google_service_account_file = env("GOOGLE_SERVICE_ACCOUNT_FILE")
    google_service_account_json = env("GOOGLE_SERVICE_ACCOUNT_JSON")
    google_sheets_live_sync_enabled = env("GOOGLE_SHEETS_LIVE_SYNC_ENABLED", "true").lower() == "true"


settings = Settings()


def validate_worker_config(environment: str, web_concurrency: int, redis_url: str) -> None:
    if environment == "production" and web_concurrency > 1 and not redis_url:
        raise RuntimeError("Production with WEB_CONCURRENCY > 1 requires REDIS_URL so rate limits are shared across workers. Set REDIS_URL or WEB_CONCURRENCY=1.")


def validate_admin_session_secret(environment: str, secret: str) -> None:
    placeholders = {"development-admin-session-secret", "replace-with-another-long-random-secret", "change-me", "secret"}
    if environment == "production" and (not secret or len(secret) < 32 or secret in placeholders):
        raise RuntimeError("ADMIN_SESSION_SECRET must be a non-placeholder value of at least 32 characters in production.")

if settings.environment == "production" and settings.allow_memory_db:
    raise RuntimeError("ALLOW_MEMORY_DB cannot be true in production.")

if settings.environment == "production" and not settings.mongodb_uri:
    raise RuntimeError("MONGODB_URI is required in production.")

validate_admin_session_secret(settings.environment, env("ADMIN_SESSION_SECRET"))
validate_worker_config(settings.environment, settings.web_concurrency, settings.redis_url)


def jsonable(value: Any) -> Any:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value
