from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.db.mongo import close_mongo, connect_mongo
from app.routes.admin_routes import router as admin_router
from app.routes.organizer_routes import router as organizer_router
from app.routes.public_routes import router as public_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        await connect_mongo()
        if settings.mongodb_uri:
            print("Connected to MongoDB")
    except Exception as error:
        print(f"MongoDB connection failed: {error}")
        if settings.node_env == "production":
            raise
    yield
    await close_mongo()


app = FastAPI(title="Noctivus API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(public_router, prefix="/api")
app.include_router(admin_router, prefix="/api/admin")
app.include_router(organizer_router, prefix="/api")


@app.exception_handler(Exception)
async def exception_handler(_request: Request, error: Exception):
    status_code = getattr(error, "status_code", 500)
    detail = getattr(error, "detail", None) or str(error) or "Server error"
    return JSONResponse(status_code=status_code, content={"message": detail})


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, error: HTTPException):
    return JSONResponse(status_code=error.status_code, content={"message": error.detail})
