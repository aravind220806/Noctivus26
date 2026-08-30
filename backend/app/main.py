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
from app.routes.admin_routes import router as admin_router
from app.routes.public_routes import router as public_router
from app.services.email_service import email_worker

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    email_stop = asyncio.Event()
    email_task = None
    try:
        await connect_mongo()
        if settings.mongodb_uri:
            print("Connected to MongoDB")
        email_task = asyncio.create_task(email_worker(email_stop))
    except Exception as error:
        print(f"MongoDB connection failed: {error}")
        if settings.node_env == "production":
            raise
    yield
    email_stop.set()
    if email_task:
        email_task.cancel()
        try:
            await email_task
        except asyncio.CancelledError:
            pass
    await close_mongo()


app = FastAPI(title="Noctivus API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(public_router, prefix="/api")
app.include_router(admin_router, prefix="/api/admin")


@app.exception_handler(Exception)
async def exception_handler(_request: Request, error: Exception):
    logger.exception("Unhandled API error", exc_info=error)
    status_code = getattr(error, "status_code", 500)
    detail = getattr(error, "detail", None) or str(error) or "Server error"
    return JSONResponse(status_code=status_code, content={"message": detail, "detail": detail})


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, error: HTTPException):
    return JSONResponse(status_code=error.status_code, content={"message": error.detail, "detail": error.detail})
