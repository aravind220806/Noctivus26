# Noctivus '26 Website Architecture

Stack: React/Vite frontend + Python/FastAPI backend API + SQLite + UPI payment QR/deep link + admin verification.

This project does not use Razorpay. Payment is handled through UPI, and payment truth is confirmed manually by organizers against the bank or UPI statement using the submitted UTR/reference number.

## 1. High-Level Components

```text
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│ React/Vite  │─────▶│ Backend API      │─────▶│ SQLite          │
│ Frontend    │◀─────│ Backend          │◀─────│ local file      │
└──────┬──────┘      │                  │      └─────────────────┘
       │             │ - Events API     │
       │             │ - Registration   │      ┌─────────────────┐
       │             │ - UTR checks     │─────▶│ Resend Email    │
       │             │ - Admin auth     │      │ optional        │
       │             │ - Admin verify   │      └─────────────────┘
       │             │ - CSV export     │
       │             └────────┬─────────┘
       │                      │
       ▼                      ▼
┌─────────────┐      ┌──────────────────┐
│ UPI apps    │      │ Google Identity  │
│ QR/deep link│      │ admin login      │
└─────────────┘      └──────────────────┘
```

## 2. Backend

The backend is Python/FastAPI and is split across routes, services, database helpers, middleware, and configuration files.

- `backend/run.py` - starts Uvicorn on the configured API port.
- `backend/requirements.txt` - Python dependencies.
- `backend/app/main.py` - FastAPI app, CORS, lifecycle, router mounting, error responses.
- `backend/app/routes/`
  - `public_routes.py` - health, event listing, UTR availability, registration submission.
  - `admin_routes.py` - Google admin login, dashboard, verification, invitations, export, analysis, access management.
- `backend/app/services/`
  - `registration_service.py` - registration create/read/update logic and memory fallback.
  - `admin_access_service.py` - owner/delegated admin access persistence.
  - `google_auth_service.py` - Google token verification.
  - `email_service.py` - Resend confirmation/pass email helpers and async email queueing.
  - `export_service.py` - CSV generation.
  - `analysis_service.py` - dashboard overview and local analysis text.
  - `validation_service.py` - registration normalization and server-side validation.
- `backend/app/middleware/admin_auth.py` - signed admin session tokens and tab guards.
- `backend/app/db/sqlite_db.py` - SQLite persistence.
- `backend/app/db/memory_store.py` - development-only memory fallback.
- `backend/app/events.py` - event catalog returned by `/api/events`.

Run it with:

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python3 run.py
```

### Current API Surface

- `GET /api/health` - health check and DB mode.
- `GET /api/events` - event catalog and registration-open status.
- `POST /api/utr/check` - checks whether a 12-digit UTR is already submitted.
- `POST /api/register` - validates and stores a pending registration.
- `POST /api/admin/auth/google` - verifies Google admin credential.
- `GET /api/admin/me` - current admin session.
- `GET /api/admin/access` - list delegated admin users.
- `PUT /api/admin/access/:email` - grant/update delegated admin tab access.
- `DELETE /api/admin/access/:email` - deactivate delegated admin access.
- `GET /api/admin/overview` - registration metrics.
- `GET /api/admin/registrations` - registration list with filters.
- `PATCH /api/admin/registrations/:id/verify` - mark payment as `confirmed`, `mismatch`, or `duplicate`.
- `POST /api/admin/invitations/send` - send invitation/pass emails through Resend when configured.
- `GET /api/admin/export` - export registrations as CSV.
- `POST /api/admin/analysis/ai` - local/offline registration analysis.

## 3. Frontend

- `frontend/src/App.jsx` - landing page, events, modal routing, main sections.
- `frontend/src/components/RegistrationModal.jsx` - multi-step registration and UPI payment flow.
- `frontend/src/admin/AdminApp.jsx` - admin dashboard, verification, invitations, export, access control.
- `frontend/src/data/site.js` - public site content and event-facing copy.
- `frontend/src/styles.css` and `frontend/src/admin/admin.css` - site and admin styling.

Registration uses one public flow:

```text
details -> review -> UPI QR/deep link -> enter 12-digit UTR -> submit -> pending verification
```

## 4. Payment Flow

The current payment method is UPI, not Razorpay.

1. Frontend calculates the selected event amount for display.
2. Frontend generates a unique payment reference like `NOC26-...`.
3. Frontend builds a UPI URI with `pa`, `pn`, `am`, `tr`, `tn`, and `cu=INR`.
4. Frontend shows a QR code and an "Open in UPI app" link.
5. User pays in their UPI app.
6. User enters the 12-digit UTR/reference number.
7. Backend revalidates event, amount, UTR format, duplicate UTR, and duplicate email/event.
8. Backend stores the registration in SQLite as `pending`.
9. Organizer reconciles the UTR and amount against the actual bank/UPI statement.
10. Admin marks the registration as `confirmed`, `mismatch`, or `duplicate`.
11. If confirmed and Resend is configured, the backend can send confirmation/pass emails.

There is no gateway webhook in this architecture. The bank/UPI statement is the source of payment truth.

## 5. Database

SQLite is the source of truth. The backend uses `aiosqlite`.

### `Registration`

```text
registrationId
participant: { name, email, phone, college, foodPreference }
normalized: { email, phone, rollNo }
eventRegistrations: [
  {
    eventId,
    eventName,
    category,
    feeSnapshot,
    teamSize,
    teamSizeMin,
    teamSizeMax,
    teamMembers: [ { name, rollNo } ]
  }
]
paymentStatus: pending | confirmed | mismatch | duplicate
utrNumber
normalizedUtr
paymentReference
expectedAmount
claimedAmount
paymentSubmittedAt
verifiedAt
verifiedBy
verificationNotes
invitation
consent
createdAt
updatedAt
```

### `AdminAccess`

```text
email
name
tabs
active
createdBy
updatedBy
createdAt
updatedAt
```

## 6. Google Sheets

Google Sheets sync is not implemented in the current backend. The implemented verification workflow is the admin dashboard plus CSV export.

If Sheets mirroring becomes a hard requirement, keep it as a downstream mirror from SQLite, not as the primary store:

1. Keep `/api/register` writing to SQLite first.
2. Trigger an async sync after registration creation or after payment confirmation, depending on what organizers want mirrored.
3. Append rows to a master sheet and event-specific tabs.
4. Track sync failures separately so a Sheets outage never blocks registration.

## 7. Security Notes

- Never treat UPI QR generation as proof of payment.
- Never auto-confirm from the frontend. Confirmation must come from organizer reconciliation.
- Public registration endpoints are IP rate-limited with `slowapi`: `/api/register` is limited to `5/minute`, and `/api/utr/check` is limited to `10/minute`.
- Validate `claimedAmount` server-side against event fees.
- Check duplicate UTRs and duplicate registrations by normalized email and event server-side.
- Production startup fails if `ALLOW_MEMORY_DB=true`.
- Production startup also fails if `ADMIN_SESSION_SECRET` is missing.
- Production runs configurable Uvicorn worker processes through `WEB_CONCURRENCY`; Render currently sets it to `1` for a free/starter-tier host, while development uses one reload-enabled worker.
- Responses larger than 1 KB use gzip compression, which reduces admin payload size on mobile connections.
- Public limits are `30 registrations/minute/IP` and `60 UTR checks/minute/IP` to reduce false throttling behind shared campus networks.
- Confirmation and invitation emails remain asynchronous and retry up to three times with exponential backoff when Resend fails.
- Keep `VITE_UPI_ID` public, but keep `ADMIN_SESSION_SECRET`, `GOOGLE_CLIENT_ID`, and `RESEND_API_KEY` server-side.
- CORS is locked to `FRONTEND_ORIGINS` and limited to `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS`.
- Admin tokens are HMAC-signed and expire after 8 hours; admin access is re-resolved server-side on protected requests.
- Keep `REGISTRATION_OPEN=false` until real payment and DB tests pass.
- Do not commit `.env` files or service credentials.

## 8. Backend Fit Check

The backend mostly matches this architecture:

- FastAPI/SQLite registration API exists.
- UPI/UTR payment verification flow exists.
- Server-side fee validation exists.
- Duplicate UTR and duplicate email/event checks exist at app and DB-index level.
- Public API rate limiting exists with rush-friendly per-IP limits.
- Google admin authentication is rate-limited to protect both the backend and Google's token verification endpoint.
- Production memory DB guard exists.
- Admin dashboard endpoints exist.
- Google admin login exists.
- CSV export exists.
- Optional Resend email exists.
- Backend responsibilities are split into routers, services, middleware, config, and DB helpers.

Known gaps or mismatches:

- The original Razorpay/Sheets draft does not match this repo.
- Google Sheets mirror is not implemented.
- Registration UI currently submits one selected event at a time, although backend validation supports multiple events.
- Capacity enforcement is not implemented in `/api/register`.
- A durable background queue is not implemented; email retries are bounded in-process and can be lost if a worker restarts.
