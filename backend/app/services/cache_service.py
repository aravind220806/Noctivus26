import time
import hashlib
import json
from typing import Any

class MemoryCache:
    """High-speed in-memory TTL cache for sub-millisecond lookups."""
    def __init__(self, default_ttl_seconds: float = 60.0):
        self._cache: dict[str, tuple[float, Any]] = {}
        self._default_ttl = default_ttl_seconds

    def get(self, key: str) -> Any | None:
        item = self._cache.get(key)
        if item is None:
            return None
        expires_at, value = item
        if time.monotonic() > expires_at:
            self._cache.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any, ttl_seconds: float | None = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl
        expires_at = time.monotonic() + ttl
        self._cache[key] = (expires_at, value)

    def delete(self, key: str) -> None:
        self._cache.pop(key, None)

    def clear(self) -> None:
        self._cache.clear()

    def invalidate_prefix(self, prefix: str) -> None:
        keys_to_del = [k for k in self._cache if k.startswith(prefix)]
        for k in keys_to_del:
            self._cache.pop(k, None)


# Global cache instances
qr_lookup_cache = MemoryCache(default_ttl_seconds=120.0)
events_cache = MemoryCache(default_ttl_seconds=30.0)
