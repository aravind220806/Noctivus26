import httpx
from fastapi import HTTPException

from app.core.config import settings


async def verify_google_credential(credential: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": credential})
    profile = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    if response.status_code >= 400:
        raise HTTPException(status_code=401, detail=profile.get("error_description") or "Google sign-in verification failed.")
    if profile.get("aud") != settings.google_client_id:
        raise HTTPException(status_code=401, detail="Google credential audience does not match this app.")
    return profile

