from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.gzip import GZipMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.mongo import close_mongo, connect_mongo
from app.db.sqlite_db import sqlite_db
from app.routes.admin_routes import router as admin_router
from app.routes.public_routes import router as public_router
from app.services.email_service import email_worker

logger = logging.getLogger(__name__)

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()"
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        return response


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Always init SQLite for persistent local storage
    await sqlite_db.init()

    email_stop = asyncio.Event()
    email_task = None
    try:
        await connect_mongo()
        logger.info("Connected to MongoDB")
        email_task = asyncio.create_task(email_worker(email_stop))
    except Exception as error:
        logger.warning("MongoDB unavailable (%s) — using SQLite for persistence", error)
        if settings.node_env == "production":
            raise
        # Still start email worker even without Mongo
        try:
            email_task = asyncio.create_task(email_worker(email_stop))
        except Exception:
            pass
    yield
    email_stop.set()
    if email_task:
        email_task.cancel()
        try:
            await email_task
        except asyncio.CancelledError:
            pass
    await close_mongo()


docs_enabled = settings.environment != "production"
app = FastAPI(
    title="Noctivus API",
    lifespan=lifespan,
    docs_url="/docs" if docs_enabled else None,
    redoc_url="/redoc" if docs_enabled else None,
    openapi_url="/openapi.json" if docs_enabled else None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Secure CORS configuration: explicit allowlist only, no wildcard regex when credentials are enabled
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_origin_regex=None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Mount primary routes with /api prefix
app.include_router(public_router, prefix="/api")
app.include_router(admin_router, prefix="/api/admin")

# Optional fallback routes for hosts that strip the /api prefix before invoking the app.
if settings.enable_unprefixed_routes:
    app.include_router(admin_router, prefix="/admin", include_in_schema=False)
    app.include_router(public_router, prefix="", include_in_schema=False)


@app.exception_handler(Exception)
async def exception_handler(_request: Request, error: Exception):
    logger.exception("Unhandled API error", exc_info=error)
    status_code = getattr(error, "status_code", 500)
    if settings.environment == "production":
        detail = "Internal server error."
    else:
        detail = getattr(error, "detail", None) or str(error) or "Internal server error."
    return JSONResponse(status_code=status_code, content={"message": detail, "detail": detail})


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, error: HTTPException):
    return JSONResponse(status_code=error.status_code, content={"message": error.detail, "detail": error.detail})
