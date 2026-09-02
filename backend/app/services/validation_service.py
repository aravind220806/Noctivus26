import re
from datetime import datetime, timezone
from typing import Any



def normalize_email(value: Any = "") -> str:
    return str(value or "").strip().lower()


def normalize_digits(value: Any = "") -> str:
    return re.sub(r"\D", "", str(value or ""))


def normalize_text(value: Any = "") -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def too_long(value: str, limit: int) -> bool:
    return len(value) > limit


def validate_registration(input_data: dict | None, configured_events: list[dict]) -> dict:
    data = input_data or {}
    errors: list[str] = []
    participant = data.get("participant") or {}
    email = normalize_email(participant.get("email"))
    phone = normalize_digits(participant.get("phone"))
    utr_number = normalize_digits(data.get("utrNumber"))
    payment_reference = normalize_text(data.get("paymentReference")).upper()
    food_preference = normalize_text(participant.get("foodPreference")).lower()
    name = normalize_text(participant.get("name")).upper()
    college = normalize_text(participant.get("college")).upper()

    if len(name) < 2:
        errors.append("Participant name is required.")
    if too_long(name, 80):
        errors.append("Participant name is too long.")
    if not re.match(r"^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$", email):
        errors.append("A valid email is required.")
    if not re.match(r"^\d{10}$", phone):
        errors.append("A valid 10-digit phone number is required.")
    if len(college) < 2:
        errors.append("College is required.")
    if too_long(college, 120):
        errors.append("College name is too long.")
    if food_preference not in ["veg", "non-veg"]:
        errors.append("Select a food preference.")
    if not re.match(r"^\d{12}$", utr_number):
        errors.append("UTR/reference number must contain 12 digits.")
    if not re.match(r"^NOC26-[A-Z0-9-]{6,29}$", payment_reference):
        errors.append("Payment reference is invalid.")
    if not (data.get("consent") or {}).get("privacyAccepted"):
        errors.append("Privacy consent is required.")

    raw_submitted_events = data.get("events") if isinstance(data.get("events"), list) else []
    if not raw_submitted_events:
        errors.append("Select at least one event.")
    if len(raw_submitted_events) > 2:
        errors.append("Members may register for a maximum of 2 events.")

    events_by_id = {event["id"]: event for event in configured_events}

    submitted_events = []
    for item in raw_submitted_events:
        if isinstance(item, str):
            conf = events_by_id.get(item)
            submitted_events.append({
                "eventId": item,
                "teamSize": conf.get("teamMin", 1) if conf else 1,
                "teamMembers": [],
            })
        elif isinstance(item, dict):
            submitted_events.append(item)

    ids = [item.get("eventId") for item in submitted_events if isinstance(item, dict)]
    if len(set(ids)) != len(ids):
        errors.append("The same event cannot be selected twice.")

    selected_configs = [events_by_id.get(eid) for eid in ids if events_by_id.get(eid)]
    has_ctf = any(e.get("is_ctf") or e["id"] == "cyber-heist-ctf" for e in selected_configs)
    tech_count = sum(1 for e in selected_configs if e.get("category") in ("tech", "Technical"))
    non_tech_count = sum(1 for e in selected_configs if e.get("category") in ("non-tech", "Non-technical"))

    if has_ctf and (non_tech_count > 0 or len(selected_configs) > 1):
        errors.append("NULL CORE 2.0 CTF is a dedicated competition and cannot be combined with other events.")

    if tech_count > 1:
        errors.append("Maximum 1 technical event allowed per registration.")
    if non_tech_count > 1:
        errors.append("Maximum 1 non-technical event allowed per registration.")

    event_registrations = []
    for submitted in submitted_events:
        configured = events_by_id.get((submitted or {}).get("eventId"))
        if not configured:
            errors.append(f"Unknown event: {(submitted or {}).get('eventId') or 'missing ID'}.")
            continue
        if configured.get("status") != "open":
            errors.append(f"{configured['name']} registration is not open.")
        if not configured.get("detailsComplete", True):
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
        for member in members:
            if not isinstance(member, dict):
                continue
            member_name = normalize_text(member.get("name"))
            member_roll = normalize_text(member.get("rollNo")).upper()
            if len(member_name) < 2:
                errors.append(f"Every {configured['name']} team member needs a name.")
            if too_long(member_name, 80) or too_long(member_roll, 40):
                errors.append(f"{configured['name']} team member details are too long.")
        ev_abstract = normalize_text(
            (submitted or {}).get("abstract")
            or (submitted or {}).get("igniteTopic")
            or participant.get("igniteTopic")
            or participant.get("abstract")
            or data.get("igniteTopic")
            or data.get("abstract")
            or ""
        )[:200]
        event_registrations.append({
            "eventId": configured["id"],
            "eventName": configured["name"],
            "category": configured["category"],
            "feeSnapshot": configured["fee"],
            "teamSize": team_size,
            "teamSizeMin": configured["teamMin"],
            "teamSizeMax": configured["teamMax"],
            "abstract": ev_abstract if (configured["id"] == "ignite" or ev_abstract) else "",
            "teamMembers": [{"name": normalize_text(member.get("name")).upper(), "rollNo": normalize_text(member.get("rollNo")).upper()} for member in members if isinstance(member, dict)],
        })

    # Flat registration fee of ₹150 covers symposium admission for up to 2 events
    expected_amount = 150 if event_registrations else 0
    if data.get("claimedAmount") != expected_amount:
        errors.append("Registration amount does not match the configured event fees.")

    overall_abstract = normalize_text(
        data.get("abstract")
        or data.get("igniteTopic")
        or participant.get("abstract")
        or participant.get("igniteTopic")
        or next((e["abstract"] for e in event_registrations if e.get("abstract")), "")
    )[:200]

    return {
        "valid": not errors,
        "errors": errors,
        "value": {
            "participant": {
                "name": name,
                "email": email,
                "phone": phone,
                "college": college,
                "foodPreference": food_preference,
                "igniteTopic": overall_abstract,
                "abstract": overall_abstract,
            },
            "abstract": overall_abstract,
            "igniteTopic": overall_abstract,
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
