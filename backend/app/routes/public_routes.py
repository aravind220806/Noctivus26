from fastapi import APIRouter, Request, Response

from app.core.rate_limit import limiter
from app.db.mongo import mongo_ready
from app.services.registration_service import check_utr_availability, create_registration, registration_status

router = APIRouter()


@router.get("/health")
async def health():
    return {"ok": True, "database": "mongo" if mongo_ready() else "memory"}


@router.get("/events")
async def events():
    return registration_status()


@router.post("/utr/check")
@limiter.limit("60/minute")
async def utr_check(request: Request, response: Response):
    payload = await request.json()
    status_code, body = await check_utr_availability((payload or {}).get("utrNumber"))
    response.status_code = status_code
    return body


@router.post("/register")
@limiter.limit("30/minute")
async def register(request: Request, response: Response):
    status_code, body = await create_registration(await request.json())
    response.status_code = status_code
    return body
