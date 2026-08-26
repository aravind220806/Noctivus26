import re
from datetime import datetime, timezone
from typing import Any

from app.events import EVENTS_BY_ID


def normalize_email(value: Any = "") -> str:
    return str(value or "").strip().lower()


def normalize_digits(value: Any = "") -> str:
    return re.sub(r"\D", "", str(value or ""))


def normalize_text(value: Any = "") -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def validate_registration(input_data: dict | None) -> dict:
    data = input_data or {}
    errors: list[str] = []
    participant = data.get("participant") or {}
    email = normalize_email(participant.get("email"))
    phone = normalize_digits(participant.get("phone"))
    utr_number = normalize_digits(data.get("utrNumber"))
    payment_reference = normalize_text(data.get("paymentReference")).upper()
    food_preference = normalize_text(participant.get("foodPreference")).lower()

    if len(normalize_text(participant.get("name"))) < 2:
        errors.append("Participant name is required.")
    if not re.match(r"^\S+@\S+\.\S+$", email):
        errors.append("A valid email is required.")
    if not re.match(r"^\d{10}$", phone):
        errors.append("A valid 10-digit phone number is required.")
    if len(normalize_text(participant.get("college"))) < 2:
        errors.append("College is required.")
    if food_preference not in ["veg", "non-veg"]:
        errors.append("Select a food preference.")
    if not re.match(r"^\d{12}$", utr_number):
        errors.append("UTR/reference number must contain 12 digits.")
    if not re.match(r"^NOC26-[A-Z0-9-]{6,29}$", payment_reference):
        errors.append("Payment reference is invalid.")
    if not (data.get("consent") or {}).get("privacyAccepted"):
        errors.append("Privacy consent is required.")

    submitted_events = data.get("events") if isinstance(data.get("events"), list) else []
    if not submitted_events:
        errors.append("Select at least one event.")
    ids = [item.get("eventId") for item in submitted_events if isinstance(item, dict)]
    if len(set(ids)) != len(ids):
        errors.append("The same event cannot be selected twice.")

    event_registrations = []
    for submitted in submitted_events:
        configured = EVENTS_BY_ID.get((submitted or {}).get("eventId"))
        if not configured:
            errors.append(f"Unknown event: {(submitted or {}).get('eventId') or 'missing ID'}.")
            continue
        if not configured["detailsComplete"]:
            errors.append(f"{configured['name']} registration details have not been announced yet.")
        try:
            team_size = int((submitted or {}).get("teamSize"))
        except (TypeError, ValueError):
            team_size = 0
        if team_size < configured["teamMin"] or team_size > configured["teamMax"]:
            size = configured["teamMax"] if configured["teamMin"] == configured["teamMax"] else f"{configured['teamMin']}-{configured['teamMax']}"
            errors.append(f"{configured['name']} requires {size} participant(s).")
        members = (submitted or {}).get("teamMembers") if isinstance((submitted or {}).get("teamMembers"), list) else []
        if len(members) != max(0, team_size - 1):
            errors.append(f"{configured['name']} team details are incomplete.")
        if any(len(normalize_text(member.get("name"))) < 2 for member in members if isinstance(member, dict)):
            errors.append(f"Every {configured['name']} team member needs a name.")
        event_registrations.append({
            "eventId": configured["id"],
            "eventName": configured["name"],
            "category": configured["category"],
            "feeSnapshot": configured["fee"],
            "teamSize": team_size,
            "teamSizeMin": configured["teamMin"],
            "teamSizeMax": configured["teamMax"],
            "teamMembers": [{"name": normalize_text(member.get("name")), "rollNo": normalize_text(member.get("rollNo")).upper()} for member in members if isinstance(member, dict)],
        })

    expected_amount = sum(event["feeSnapshot"] for event in event_registrations)
    if data.get("claimedAmount") != expected_amount:
        errors.append("Registration amount does not match the configured event fees.")

    return {
        "valid": not errors,
        "errors": errors,
        "value": {
            "participant": {
                "name": normalize_text(participant.get("name")),
                "email": email,
                "phone": phone,
                "college": normalize_text(participant.get("college")),
                "foodPreference": food_preference,
            },
            "normalized": {"email": email, "phone": phone, "rollNo": ""},
            "eventRegistrations": event_registrations,
            "utrNumber": utr_number,
            "normalizedUtr": utr_number,
            "paymentReference": payment_reference,
            "expectedAmount": expected_amount,
            "claimedAmount": data.get("claimedAmount"),
            "consent": {"privacyAccepted": True, "rulesAccepted": True, "acceptedAt": datetime.now(timezone.utc)},
        },
    }

