# Sympo Website — Workflow

## 1. User-Facing Flow (Registration + Payment)

```
Visit site → Browse events → Pick event → Fill registration form
   → Submit → Backend creates "pending" registration in DB
   → Backend creates Razorpay order → returns order_id
   → Razorpay Checkout modal opens
   → User pays
   → Razorpay redirects/callbacks frontend with payment_id + signature
   → Frontend sends these to backend /verify endpoint
   → Backend verifies signature
   → Backend also gets webhook (async, authoritative) confirming payment.captured
   → Registration marked "paid" in DB
   → Background job pushes row to:
        - Master Google Sheet (all events)
        - Event-specific Google Sheet tab
   → User sees confirmation page / gets email (future automation)
```

## 2. Development Workflow (Team)

Phase 1 — Foundation
- Finalize event list + fee structure + fields needed per event (some events may need extra fields — keep form config-driven, not hardcoded)
- Set up FastAPI skeleton + Postgres/SQLite + basic event CRUD
- Set up React skeleton, routing, event listing page

Phase 2 — Registration + Payment
- Build registration form (config-driven per event)
- Integrate Razorpay order creation + checkout
- Implement signature verification endpoint
- Implement Razorpay webhook endpoint (separate from frontend verify — belt and suspenders)

Phase 3 — Sheets Automation
- Service account setup, share sheet access
- Build sync service: append to Master + event tab
- Add retry/dead-letter handling so failed Sheets writes don't get silently lost
- Manual "resync" endpoint/admin action for recovering from a Sheets outage

Phase 4 — Polish + Extra Automations (future)
- Email/WhatsApp confirmation on successful payment
- Certificate generation
- QR-based check-in

## 3. Branching / Repo Workflow (suggestion)
- `main` — production
- `dev` — integration branch
- Feature branches: `feat/registration-form`, `feat/razorpay-integration`, `feat/sheets-sync`
- Backend and frontend can live in one monorepo (`/backend`, `/frontend`) for a symposium-scale project — simpler deploy, one PR can touch both sides when API contracts change

## 4. Environments
- Local dev: SQLite + Razorpay test mode + a test Google Sheet
- Staging: mirrors prod, Razorpay test keys, separate Sheet
- Prod: Postgres, Razorpay live keys, real Sheet, webhook URL registered in Razorpay dashboard

## 5. Failure Modes to Design For
- Payment succeeds but signature verify request fails (network) → webhook must be the safety net
- Sheets API down/rate-limited → job retries, doesn't block user-facing flow
- Duplicate registration submission (double-click, refresh) → idempotency key on registration create
- Event fills up mid-payment → capacity check before order creation, re-check before confirming paid
