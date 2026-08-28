import csv
import io


def _safe_csv_value(value):
    if not isinstance(value, str):
        return value
    if value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


def registrations_to_csv(registrations: list[dict], sponsor_safe: bool = False) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    if sponsor_safe:
        writer.writerow(["Name", "College", "Events"])
    else:
        writer.writerow(["Registration ID", "Name", "Email", "Phone", "College", "Food", "Events", "Status", "UTR", "Expected Amount", "Claimed Amount", "Checked In", "Checked In At", "Submitted At", "Verified At"])
    for registration in registrations:
        participant = registration.get("participant") or {}
        values = [
            participant.get("name"), participant.get("college"), "; ".join(event.get("eventName", "") for event in registration.get("eventRegistrations", [])),
        ] if sponsor_safe else [
            registration.get("registrationId"),
            participant.get("name"),
            participant.get("email"),
            participant.get("phone"),
            participant.get("college"),
            participant.get("foodPreference"),
            "; ".join(event.get("eventName", "") for event in registration.get("eventRegistrations", [])),
            registration.get("paymentStatus"),
            registration.get("utrNumber"),
            registration.get("expectedAmount"),
            registration.get("claimedAmount"),
            registration.get("checkedIn", False),
            registration.get("checkedInAt"),
            registration.get("paymentSubmittedAt"),
            registration.get("verifiedAt"),
        ]
        writer.writerow(_safe_csv_value(value) for value in values)
    return output.getvalue()
