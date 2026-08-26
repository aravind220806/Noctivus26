# Noctivus Backend

## Overview

The backend is a modular Python FastAPI service. It is the source of truth for registrations and uses MongoDB for persistence. Local development can use an explicit in-memory fallback; production requires MongoDB.

The payment flow is UPI plus manual UTR verification. There is no Razorpay or other payment gateway in this project. The frontend creates a UPI QR/deep link, and an organizer confirms the submitted UTR against the bank or UPI statement.

## Technology

- Python 3.10+
- FastAPI and Uvicorn
- Motor async MongoDB driver
- MongoDB Atlas or local MongoDB
- SlowAPI for IP-based rate limiting
- Resend for optional email delivery
- Google OAuth credential verification for admin login
- React/Vite frontend in `frontend/`

Node.js is used only to develop and build the React frontend. The backend runtime is Python. The old Node backend was removed.

## Directory Structure

```text
backend/
├── .env.example             # Backend environment template
├── Dockerfile               # Python container image
├── requirements.txt         # Python dependencies
├── run.py                   # Uvicorn entrypoint and worker configuration
└── app/
    ├── main.py              # FastAPI app, middleware, lifecycle, routers
    ├── events.py            # Server-side event catalog and fees
    ├── core/
    │   ├── config.py        # Environment loading and production guards
    │   └── rate_limit.py    # SlowAPI limiter configuration
    ├── db/
    │   ├── mongo.py         # Async MongoDB client, indexes, connection
    │   └── memory_store.py  # Explicit local-development fallback
    ├── middleware/
    │   └── admin_auth.py    # Signed admin sessions and permission checks
    ├── routes/
    │   ├── public_routes.py # Health, events, UTR, registration APIs
    │   └── admin_routes.py  # Admin login and protected operations
    └── services/
        ├── registration_service.py # Registration persistence and updates
        ├── validation_service.py   # Input, fee, event, and UTR validation
        ├── admin_access_service.py # Owner and delegated admin access
        ├── google_auth_service.py  # Google credential verification
        ├── email_service.py        # Async Resend email and retries
        ├── export_service.py       # CSV export with formula protection
        └── analysis_service.py     # Dashboard metrics and offline analysis
```

## Request Flows

### Public registration

```text
React form
  -> POST /api/register
  -> rate limit
  -> validation_service
  -> registration_service
  -> MongoDB or explicit local memory store
  -> pending registration
```

The backend does not trust client event names or prices. It resolves selected event IDs from `app/events.py`, calculates the expected amount, validates the UTR, and checks duplicates before saving.

### Payment verification

```text
User pays through UPI
  -> submits UTR/reference with registration
  -> backend stores paymentStatus=pending
  -> admin checks bank/UPI statement
  -> PATCH /api/admin/registrations/{id}/verify
  -> confirmed, mismatch, or duplicate
  -> optional confirmation email
```

The frontend cannot mark a payment as confirmed. There is no payment gateway webhook because payment is manual UPI reconciliation.

### Admin authentication

```text
Google credential
  -> POST /api/admin/auth/google
  -> server verifies credential with Google
  -> email checked against owner/delegated access
  -> signed 8-hour admin session returned
  -> every protected request verifies signature and rechecks access
```

Admin tab permissions are enforced by backend dependencies, not only by hidden frontend controls.

## API Routes

### Public routes

- `GET /api/health` - reports service health and active database mode.
- `GET /api/events` - returns the server-side event catalog.
- `POST /api/utr/check` - checks UTR format and whether it is already used.
- `POST /api/register` - validates and stores a pending registration.

Rate limits are currently per source IP:

- Registration: `30/minute`
- UTR check: `60/minute`

These limits reduce abuse while allowing users behind a shared campus network to register during a rush.

### Admin routes

- `POST /api/admin/auth/google` - Google login, limited to `10/minute/IP`.
- `GET /api/admin/me` - current admin session and permissions.
- `GET /api/admin/access` - list delegated admin access.
- `PUT /api/admin/access/{email}` - grant or update delegated tabs.
- `DELETE /api/admin/access/{email}` - deactivate delegated access.
- `GET /api/admin/overview` - dashboard metrics.
- `GET /api/admin/registrations` - filtered registration list.
- `PATCH /api/admin/registrations/{id}/verify` - confirm, reject as mismatch, or mark duplicate.
- `POST /api/admin/invitations/send` - queue event pass emails.
- `GET /api/admin/export` - protected CSV export.
- `POST /api/admin/analysis/ai` - offline registration analysis.

The former organizer-secret route `PATCH /api/registrations/{id}` was removed because it bypassed Google authentication and tab permissions.

## Data Storage

MongoDB is the production source of truth. Startup creates these important indexes:

- Unique `registrationId`
- Unique sparse `normalizedUtr`
- Unique compound `normalized.email` plus `eventRegistrations.eventId`
- Lookup indexes for email, event, payment status, and admin access

The unique indexes protect against duplicate UTRs and duplicate email/event registrations even when concurrent requests reach different workers.

The in-memory store is only for local development. Production startup fails when `ALLOW_MEMORY_DB=true` or `MONGODB_URI` is missing.

## Security Fixes Completed

- Removed the legacy organizer bearer-secret write endpoint.
- Removed the unused `ORGANIZER_SECRET` deployment configuration.
- Admin tokens use HMAC signing and constant-time signature comparison.
- Admin tokens expire after 8 hours.
- Protected requests re-resolve delegated access from the database.
- Owner accounts cannot be edited or deactivated through delegated access management.
- Google admin login is rate-limited.
- Public registration and UTR endpoints are rate-limited.
- Production requires `ADMIN_SESSION_SECRET`.
- Production rejects memory-only storage and missing MongoDB configuration.
- CORS uses the configured `FRONTEND_ORIGINS` list.
- Registration input lengths, email, phone, event IDs, fees, and UTR values are validated server-side.
- MongoDB unique indexes close application-level race conditions.
- CSV values beginning with `=`, `+`, `-`, or `@` are escaped to prevent spreadsheet formula injection.
- Invitation email fields are HTML-escaped and image data is size-limited.
- Resend calls check HTTP status and retry up to three times with exponential backoff.
- Email delivery stays asynchronous so registration and admin responses do not wait on Resend.

## Performance and Load Handling

The API is primarily I/O-bound. MongoDB calls use the async Motor driver, and email calls are queued outside the request response.

- `WEB_CONCURRENCY` controls Uvicorn workers.
- Local development uses one reload-enabled worker.
- Render is explicitly configured with `WEB_CONCURRENCY=1` for a free/starter-tier host.
- A multi-core paid instance can use `WEB_CONCURRENCY=2` or higher after load testing.
- MongoDB pool defaults are `minPoolSize=2` and `maxPoolSize=20`.
- Responses larger than 1 KB use gzip compression.
- Rate limiting is currently in-memory and per process. For multiple workers or multiple instances, use shared Redis-backed limiter storage before relying on it as a distributed control.

## Environment Variables

Copy `backend/.env.example` to `backend/.env` for local development.

Required for production:

```text
ENVIRONMENT=production
MONGODB_URI=<private MongoDB connection string>
MONGODB_DB=noctivus
FRONTEND_ORIGINS=https://<frontend-domain>
ADMIN_SESSION_SECRET=<long-random-secret>
REGISTRATION_OPEN=false
```

Optional settings:

```text
PORT=4000
WEB_CONCURRENCY=1
MONGODB_MAX_POOL_SIZE=20
MONGODB_MIN_POOL_SIZE=2
MONGODB_SERVER_SELECTION_TIMEOUT_MS=8000
GOOGLE_CLIENT_ID=<Google OAuth client ID>
ADMIN_EMAILS=owner@example.com
RESEND_API_KEY=<Resend API key>
CONFIRM_FROM=Noctivus 26 <registrations@example.com>
```

Never commit `.env`, MongoDB credentials, OAuth secrets, email API keys, or generated session secrets.

## Local Development

```bash
make install
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
make dev-api
```

In another terminal:

```bash
make dev-frontend
```

Useful commands:

```bash
make test     # Python compilation check
make build    # React production build
make clean    # Remove generated caches and frontend dist
```

The backend can run without MongoDB locally when `ALLOW_MEMORY_DB=true`. Memory data is lost when the process stops.

## Deployment

### Render

`render.yaml` configures:

- Python runtime
- `pip install -r requirements.txt` build
- `python run.py` start command
- `/api/health` health check
- Generated `ADMIN_SESSION_SECRET`
- One worker by default for free/starter resources

Set `MONGODB_URI`, `FRONTEND_ORIGINS`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS`, and email variables in the Render dashboard as required.

### Docker

```bash
docker build -t noctivus-api backend
docker run --env-file backend/.env -p 4000:4000 noctivus-api
```

The container runs `python run.py` and reads `PORT` and `WEB_CONCURRENCY` from the environment.

## Current Gaps and Next Work

- Google Sheets mirror is not implemented.
- Email retries are in-process; a durable queue would be needed for guaranteed delivery across restarts.
- Rate-limit state is not shared between workers; configure Redis for multi-worker or multi-instance distributed limiting.
- Registration capacity is not currently enforced server-side.
- Production MongoDB connectivity and a 300-user load test still need to be run against the deployed environment.
- Owner sessions cannot be individually revoked; rotating `ADMIN_SESSION_SECRET` invalidates all sessions.

## Verification

The project currently verifies with:

```bash
make test
npm run build
```

The latest backend security and deployment changes are kept in Git history on the `main` branch.
