# Sympo Website — Architecture

Stack: FastAPI (backend) + React (frontend) + Razorpay (payments) + MongoDB (primary store) + Google Sheets (data mirror)

## 1. High-Level Components

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   React     │─────▶│   FastAPI        │─────▶│   Razorpay      │
│  Frontend   │◀─────│   Backend        │◀─────│   (Orders/      │
└─────────────┘      │                  │      │    Webhooks)    │
                      │                  │
                      │  - Auth (opt)    │      ┌─────────────────┐
                      │  - Event mgmt    │─────▶│   MongoDB       │
                      │  - Reg + Payment │      │   (Atlas/local) │
                      │  - Sheets sync   │      └─────────────────┘
                      └────────┬─────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  Google Sheets   │
                      │  API (per-event  │
                      │  tabs + master   │
                      │  copy)           │
                      └──────────────────┘
```

## 2. Backend (FastAPI)

### Modules
- `app/main.py` — app init, CORS, router mounting
- `app/routers/`
  - `events.py` — CRUD/list of symposium events
  - `registrations.py` — create registration, get status
  - `payments.py` — create Razorpay order, verify signature, webhook handler
  - `sheets.py` — internal service, not exposed directly
- `app/services/`
  - `razorpay_service.py` — order creation, signature verification
  - `sheets_service.py` — push row to correct event tab + master sheet
  - `db_service.py` — Mongo persistence layer (source of truth, DB first)
- `app/models/` — Pydantic schemas (used both for API validation and Mongo document shape)
- `app/db/` — Mongo client setup (`motor` async driver), collection helpers
- `app/core/config.py` — env vars, secrets (Razorpay keys, Google service account)
- `app/workers/` — background tasks (async sheet push, retries)

### Why DB + Sheets (not Sheets-only)
- DB is source of truth (fast, queryable, avoids Sheets API rate limits/race conditions on concurrent writes).
- Sheets is a downstream mirror for organizers — non-negotiable requirement, but should never be the primary store.
- Flow: registration → write to DB (fast, authoritative) → enqueue async job → job writes to event-specific sheet tab + master "all registrations" sheet.

### Payment Flow (Razorpay)
1. Frontend requests order creation → backend calls Razorpay Orders API → returns `order_id`.
2. Frontend opens Razorpay Checkout with `order_id`.
3. On success, frontend sends `razorpay_payment_id`, `order_id`, `signature` to backend.
4. Backend verifies signature server-side (never trust client-side "success").
5. Also register a Razorpay webhook (`payment.captured`, `payment.failed`) as the authoritative source — frontend confirmation is UX-only, webhook confirms truth.
6. On confirmed payment → mark registration `paid` in DB → trigger Sheets sync.

## 3. Frontend (React)

- `pages/` — Landing, Events list, Event detail, Registration form, Payment status, My registrations (if auth)
- `components/` — EventCard, RegistrationForm, PaymentButton, StatusBadge
- `services/api.ts` — typed API client (axios/fetch wrapper)
- `services/razorpay.ts` — loads checkout.js, opens modal, handles callback
- State: React Query (server state) + minimal local state; avoid Redux unless team already knows it

## 4. Google Sheets Automation

- One Google Cloud service account, shared Editor access to a Sheets file
- Sheet structure:
  - `Master` tab — every registration, all events, append-only log
  - One tab per event (e.g. `Hackathon`, `Paper Presentation`) — filtered copy
- Sync strategy: on payment confirmation (or free-registration confirmation), background task:
  1. Append row to `Master`
  2. Append row to the matching event tab (create tab if missing)
- Use Google Sheets API v4 batchUpdate/append, with retry + dead-letter queue (failed syncs logged, retried, alertable) so a Sheets hiccup never blocks registration.

## 5. Data Model (draft)

```
Event: id, name, slug, fee, capacity, is_active
Registration: id, event_id, name, email, phone, college, payment_status,
              razorpay_order_id, razorpay_payment_id, created_at
```

## 6. Security Notes
- Razorpay signature verification is mandatory server-side — never mark paid based on frontend alone
- Webhook endpoint must verify Razorpay webhook signature separately (different secret from checkout)
- Service account JSON for Sheets → env/secret manager, never committed
- Rate-limit registration endpoint (avoid spam/duplicate submissions)
- CORS locked to actual frontend domain in production
