import csv
import io


def registrations_to_csv(registrations: list[dict]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Registration ID", "Name", "Email", "Phone", "College", "Food", "Events", "Status", "UTR", "Expected Amount", "Claimed Amount", "Submitted At", "Verified At"])
    for registration in registrations:
        participant = registration.get("participant") or {}
        writer.writerow([
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
            registration.get("paymentSubmittedAt"),
            registration.get("verifiedAt"),
        ])
    return output.getvalue()

