import logging
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

logger = logging.getLogger(__name__)

storage_uri = settings.redis_url or "memory://"
if settings.environment == "production" and not settings.redis_url:
    logger.warning("REDIS_URL not configured in production; rate limiting falling back to in-memory store.")

limiter = Limiter(key_func=get_remote_address, storage_uri=storage_uri)
