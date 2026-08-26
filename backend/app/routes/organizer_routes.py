from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, Request

from app.core.config import settings
from app.services.email_service import queue_email, send_confirmation
from app.services.registration_service import update_registration

router = APIRouter()


@router.patch("/registrations/{registration_id}")
async def legacy_verify(registration_id: str, request: Request, authorization: str | None = Header(default=None)):
    provided = str(authorization or "").replace("Bearer ", "", 1).replace("bearer ", "", 1)
    if not settings.organizer_secret or provided != settings.organizer_secret:
        raise HTTPException(status_code=401, detail="Organizer authorization required.")
    body = await request.json()
    if body.get("status") not in ["confirmed", "mismatch", "duplicate"]:
        raise HTTPException(status_code=400, detail="Invalid registration status.")
    update = {"paymentStatus": body["status"], "verifiedAt": datetime.now(timezone.utc), "verifiedBy": "organizer-api", "verificationNotes": str(body.get("notes") or "")[:500]}
    registration = await update_registration(registration_id, update)
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found.")
    if update["paymentStatus"] == "confirmed":
        queue_email(lambda: send_confirmation(registration))
    return {"registrationId": registration.get("registrationId"), "status": registration.get("paymentStatus")}
