# Sympo Website — Workflow

## 1. User-Facing Flow (Registration + Payment)

```
Visit site → Browse events → Pick event → Fill registration form
   → Submit → Backend validates, creates "pending" registration in MongoDB
   → Backend generates a high-entropy QR token stored on the record
   → User pays via UPI (QR code or UPI deep-link shown on confirmation page)
   → User submits their 12-digit UTR reference number with registration
   → Admin logs into dashboard, opens Verify Members tab
   → Admin checks UTR against bank/UPI statement
   → Admin marks payment: confirmed / mismatch / duplicate
   → Confirmation email sent via Resend (async, does not block the flow)
   → Pass/invitation email sent when admin triggers it from Invitations tab
   → Participant receives QR-coded boarding pass
   → At venue: scanner reads QR → POST /api/p/{qrToken}/check-in
   → Registration marked checked-in in real time
```

**Payment gateway:** Manual UPI + UTR reconciliation. There is no Razorpay
or other third-party payment gateway in this project. The frontend generates
a UPI QR/deep-link; payment verification is a manual admin step.

## 2. Development Workflow (Team)

Phase 1 — Foundation ✅
- Finalize event list + fee structure + fields (config-driven)
- FastAPI backend + MongoDB + React/Vite frontend

Phase 2 — Registration + Payment ✅
- Config-driven registration form with server-side validation
- UPI QR display + UTR submission on confirmation page
- Admin dashboard: verify UTR, confirm/reject, mark duplicate

Phase 3 — Invitations + Pass System ✅
- Admin triggers invitation emails with boarding-pass QR
- Public pass page at /p/{qrToken} shows event details
- QR-based check-in via /p/{qrToken}/check-in

Phase 4 — Polish + Future Work
- Google Sheets mirror (described in BACKEND.md as not yet implemented)
- Capacity/concurrency load testing
- Redis-backed rate limiting for multi-worker deployments
- Admin session revocation per-token

## 3. Branching / Repo Workflow
- `main` — production
- Feature branches off main; one PR per feature

Backend and frontend live in one monorepo (`/backend`, `/frontend`).

## 4. Environments
- Local dev: `ALLOW_MEMORY_DB=true`, no MongoDB required, dev-login shortcut
- Staging: real MongoDB Atlas, `ENVIRONMENT=staging`, test Google OAuth
- Prod: MongoDB Atlas, `ENVIRONMENT=production`, real Google OAuth, Resend email

## 5. Failure Modes Addressed
- Duplicate registration (double-click/refresh) → `Idempotency-Key` header
- Duplicate UTR → unique sparse MongoDB index + application check
- Duplicate email+event → unique compound index
- Event fills up mid-registration → atomic capacity counter with rollback
- Mongo unreachable → `/health` returns 503 degraded; production crashes at startup
- Admin session replay → HMAC-signed 8-hour tokens, re-resolved access on each request
- CSRF → synchronizer token in session; required as `X-CSRF-Token` on mutating admin routes
