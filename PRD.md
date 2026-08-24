# Sympo Website — PRD

## 1. Overview
A symposium website where students can browse events, register, and pay via Razorpay. Every registration is stored reliably (MongoDB) and mirrored into Google Sheets (Master tab + per-event tab) for organizers.

## 2. Goals
- Let students discover events and register with payment in a smooth, low-friction flow.
- Never oversell capacity, never lose a paid registration.
- Give organizers a live, per-event Google Sheet view without them touching any dashboard.
- Leave room for automations (email/WhatsApp confirmations, certificates, QR check-in) without re-architecting later.

## 3. Non-Goals (for now)
- No organizer admin dashboard UI (Sheets is the dashboard, for now).
- No user accounts/login system (unless later required — registration is email/phone based, not account-based).
- No multi-currency support — INR only via Razorpay.

## 4. Users
- **Student/participant** — browses events, registers, pays.
- **Organizer** — views registrations via Google Sheets (Master + per-event tabs).
- **Admin (you/team)** — manages event list, fees, capacity; monitors payment/Sheets sync health.

## 5. Core Features

### 5.1 Event Listing
- Public list of events: name, description, fee, capacity remaining, category.
- Event detail page with registration form.

### 5.2 Registration
- Config-driven form per event (fields may differ per event).
- Duplicate-submission protection (idempotency key per submit).
- Capacity check before allowing payment to start.

### 5.3 Payment (Razorpay)
- Create order → Razorpay Checkout → client-side callback verification → server-side signature verification → webhook as final source of truth.
- Registration status: `pending` → `paid` / `failed`.

### 5.4 Data Storage (MongoDB)
- Primary store for events, registrations, payment status.
- Fast lookups: check capacity, check duplicate, check payment status by order_id.

### 5.5 Google Sheets Sync
- On confirmed payment: append row to `Master` sheet + matching event-specific tab.
- Async, retried on failure, never blocks user-facing flow.
- Manual re-sync capability for recovering from an outage.

### 5.6 Future Automations (Phase 4+)
- Email/WhatsApp confirmation on successful payment.
- Certificate generation (post-event).
- QR-based check-in at event venue.

## 6. Data Model (MongoDB collections, draft)

```
events
  _id, name, slug, description, fee, capacity, registered_count, is_active, fields_config

registrations
  _id, event_id, name, email, phone, college, extra_fields (per event_config),
  payment_status ("pending"/"paid"/"failed"),
  razorpay_order_id, razorpay_payment_id,
  idempotency_key, created_at, updated_at
```

## 7. Success Metrics
- Zero overselling incidents.
- Zero "paid but not recorded" registrations (webhook + verify as double safety net).
- Sheets sync lag under a few minutes even under load.
- Registration-to-payment completion rate (drop-off tracking, informal).

## 8. Risks
- Sheets API rate limits during a registration rush → mitigated by async queue + retries, Mongo as fast primary store.
- Razorpay webhook delivery delay/failure → mitigated by combining client verify + webhook, plus a periodic reconciliation job against Razorpay's API.
- Concurrent registration for last seat → capacity check + atomic Mongo update (`findOneAndUpdate` with capacity guard) instead of read-then-write.

---

# Phased Plan

## Phase 0 — Setup
- Repo structure (`/backend`, `/frontend`), env config, Razorpay test account, Google Cloud service account + test Sheet.
- MongoDB: local (Docker) for dev, MongoDB Atlas free tier for staging/prod.

## Phase 1 — Foundation
- FastAPI skeleton + Mongo connection (via `motor` for async, or `pymongo`).
- Event CRUD (admin-only, can be simple scripts/seed data initially, no UI needed yet).
- React skeleton, routing, event listing page pulling from `/events` API.

## Phase 2 — Registration + Payment
- Config-driven registration form (frontend) + `/registrations` endpoint.
- Capacity check + idempotency key handling.
- Razorpay order creation endpoint.
- Razorpay Checkout integration (frontend).
- Signature verification endpoint (`/payments/verify`).
- Razorpay webhook endpoint (`/payments/webhook`) — authoritative payment confirmation.

## Phase 3 — Sheets Automation
- Google Sheets API service account integration.
- Background job (e.g. FastAPI `BackgroundTasks` or a simple queue) to push confirmed registrations to Master + event tab.
- Retry/dead-letter handling for failed syncs.
- Manual "resync from Mongo" endpoint for recovery.

## Phase 4 — Automations & Polish
- Email/WhatsApp confirmation on payment success.
- Certificate generation pipeline.
- QR check-in flow for event day.
- Basic monitoring: sync failures, payment mismatches, alerting (even just a Slack/email ping).

## Phase 5 — Hardening (pre-launch)
- Load test registration flow (simulate rush).
- Reconciliation job: compare Mongo `paid` registrations against Razorpay dashboard periodically.
- Security pass: rate limiting, CORS lock-down, secrets audit.
