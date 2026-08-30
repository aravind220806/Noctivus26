from app.services.event_service import _is_closed
from app.services.registration_service import serialize_registration


def build_overview(registrations: list[dict], catalog: list[dict] | None = None) -> dict:
    catalog = catalog or []
    statuses = {"pending": 0, "confirmed": 0, "mismatch": 0, "duplicate": 0}
    events = {
        event["id"]: {
            "eventId": event["id"],
            "eventName": event["name"],
            "category": event.get("category", ""),
            "venue": event.get("venue", ""),
            "date": event.get("date", ""),
            "time": event.get("time", ""),
            "status": event.get("status", "open"),
            "effectiveStatus": "closed" if _is_closed(event) else event.get("status", "open"),
            "fee": event.get("fee", 0),
            "registrations": 0,
            "confirmed": 0,
            "pending": 0,
            "checkedIn": 0,
            "revenue": 0,
        }
        for event in catalog
    }
    expected_revenue = 0
    confirmed_revenue = 0
    for registration in registrations:
        status = registration.get("paymentStatus")
        statuses[status] = statuses.get(status, 0) + 1
        expected_revenue += int(registration.get("expectedAmount") or 0)
        if status == "confirmed":
            confirmed_revenue += int(registration.get("expectedAmount") or 0)
        for entry in registration.get("eventRegistrations", []):
            row = events.setdefault(entry.get("eventId"), {"eventId": entry.get("eventId"), "eventName": entry.get("eventName") or entry.get("eventId"), "category": entry.get("category") or "", "registrations": 0, "confirmed": 0, "pending": 0, "revenue": 0})
            row["registrations"] += 1
            if status == "confirmed":
                row["confirmed"] += 1
                row["revenue"] += int(entry.get("feeSnapshot") or registration.get("expectedAmount") or 0)
            if status == "pending":
                row["pending"] += 1
            if registration.get("checkedIn") is True:
                row["checkedIn"] += 1
    return {
        "total": len(registrations),
        "statuses": statuses,
        "expectedRevenue": expected_revenue,
        "confirmedRevenue": confirmed_revenue,
        "checkedIn": sum(item.get("checkedIn") is True for item in registrations),
        "events": list(events.values()),
        "recent": [serialize_registration(item) for item in registrations[:8]],
    }


async def create_ai_analysis(overview: dict) -> str:
    total = overview["total"]
    pending_rate = round((overview["statuses"]["pending"] / total) * 100) if total else 0
    confirmation_rate = round((overview["statuses"]["confirmed"] / total) * 100) if total else 0
    mismatch_rate = round(((overview["statuses"]["mismatch"] + overview["statuses"]["duplicate"]) / total) * 100) if total else 0
    sorted_events = sorted(overview["events"], key=lambda item: item["registrations"], reverse=True)
    top_event = sorted_events[0] if sorted_events else None
    slow_events = [event["eventName"] for event in sorted_events if event["registrations"] == 0]
    pending_events = sorted([event for event in overview["events"] if event["pending"] > 0], key=lambda item: item["pending"], reverse=True)
    revenue_events = sorted([event for event in overview["events"] if event["revenue"] > 0], key=lambda item: item["revenue"], reverse=True)

    lines = [
        "Offline analysis",
        f"Total registrations: {total}",
        f"Payment status: {overview['statuses']['confirmed']} confirmed, {overview['statuses']['pending']} pending, {overview['statuses']['mismatch']} mismatch, {overview['statuses']['duplicate']} duplicate.",
        f"Confirmation rate: {confirmation_rate}%. Pending rate: {pending_rate}%. Exception rate: {mismatch_rate}%.",
        f"Revenue: Rs.{overview['confirmedRevenue']} confirmed from Rs.{overview['expectedRevenue']} expected.",
    ]
    if top_event:
        lines.append(f"Highest registration event: {top_event['eventName']} with {top_event['registrations']} members.")
    if revenue_events:
        lines.append(f"Highest confirmed revenue event: {revenue_events[0]['eventName']} with Rs.{revenue_events[0]['revenue']}.")
    if pending_events:
        lines.append(f"Payment verification priority: {pending_events[0]['eventName']} has {pending_events[0]['pending']} pending payment(s).")
    if slow_events:
        lines.append(f"Events needing promotion: {', '.join(slow_events)}.")
    lines.append("Event-wise breakdown:")
    for event in overview["events"]:
        lines.append(f"- {event['eventName']}: {event['registrations']} total, {event['confirmed']} confirmed, {event['pending']} pending, Rs.{event['revenue']} confirmed revenue.")
    recommendations = []
    if overview["statuses"]["pending"] > 0:
        recommendations.append("Verify pending UTRs before sending invitation passes.")
    if mismatch_rate > 10:
        recommendations.append("Check mismatch and duplicate cases manually before exporting final participant lists.")
    if slow_events:
        recommendations.append("Push event-specific announcements for events with zero registrations.")
    if not recommendations:
        recommendations.append("Registration flow looks stable. Continue monitoring event-wise demand and payment confirmations.")
    lines.append("Recommended actions:")
    lines.extend(f"- {item}" for item in recommendations)
    return "\n".join(lines)
