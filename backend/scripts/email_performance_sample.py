import argparse
import asyncio
import time
from datetime import datetime, timezone

from app.db.sqlite_db import sqlite_db
from app.services.email_service import sendPaymentConfirmationEmail


SAMPLE_EMAIL = "bbhstory12@gmail.com"
SAMPLE_REGISTRATION_ID = "NOC26-EMAILTEST"


def sample_registration() -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "registrationId": SAMPLE_REGISTRATION_ID,
        "member_id": SAMPLE_REGISTRATION_ID,
        "participant": {
            "name": "EMAIL PERFORMANCE TEST",
            "email": SAMPLE_EMAIL,
            "phone": "9876543210",
            "college": "NOCTIVUS TEST COLLEGE",
            "foodPreference": "veg",
        },
        "eventRegistrations": [{
            "eventId": "bug-hunt",
            "eventName": "Bug Hunt",
            "category": "tech",
            "feeSnapshot": 150,
            "teamSize": 1,
            "teamMembers": [],
        }],
        "event_ids": ["bug-hunt"],
        "utrNumber": "999999999999",
        "normalizedUtr": "999999999999",
        "paymentReference": SAMPLE_REGISTRATION_ID,
        "expectedAmount": 150,
        "claimedAmount": 150,
        "paymentStatus": "confirmed",
        "payment_email_status": "queued",
        "payment_email_error": None,
        "createdAt": now,
        "updatedAt": now,
    }


async def main(send: bool) -> None:
    await sqlite_db.init()
    registration = sample_registration()
    await sqlite_db.upsert("registrations", SAMPLE_REGISTRATION_ID, registration)
    print(f"Sample registration ready: {SAMPLE_REGISTRATION_ID} ({SAMPLE_EMAIL})")

    if not send:
        print("No email sent. Run `make email-sample-send` to measure live delivery.")
        return

    started = time.perf_counter()
    result = await sendPaymentConfirmationEmail(registration)
    elapsed_ms = (time.perf_counter() - started) * 1000
    print(f"Email result: {result}; elapsed_ms={elapsed_ms:.1f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create and optionally email a synthetic registration.")
    parser.add_argument("--send", action="store_true", help="send the confirmation email after inserting the sample")
    args = parser.parse_args()
    asyncio.run(main(args.send))