# Noctivus '26 — Security Review (4 September 2026)

Scope: full read of the FastAPI backend, the React/Vite frontend, deployment configs
(Render, Vercel, Docker + nginx), and the test suite. Every fix below was verified by
running the backend tests: **37 passed** (24 pre-existing, of which 2 were failing
before the fixes, plus 13 new regression tests in `backend/tests/test_security_fixes.py`).

---

## Status of the credential finding, and one required configuration step

Detailed write-ups and copy-paste fix prompts for every item still open are in
[SECURITY_OPEN_ITEMS.md](SECURITY_OPEN_ITEMS.md).

### 1. Leaked Google service-account key: accepted risk (owner decision)

`backend/.env.example` contained a complete RSA private key for
`noctivus@sympo-api.iam.gserviceaccount.com` plus the live spreadsheet ID. The repository is
private and the owner has decided not to rotate the key. The key was removed from the template
only because no code reads `GOOGLE_PRIVATE_KEY` (the service reads
`GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_SERVICE_ACCOUNT_FILE`), so nothing changed
functionally. Anyone with repo access, old clones, or the Docker image built from this tree
can still use the key. If the decision changes: Google Cloud Console → IAM & Admin → Service
Accounts → the account above → Keys → delete all keys, create a new JSON key, and set it as
`GOOGLE_SERVICE_ACCOUNT_JSON` on the host.

### 2. Set production environment variables everywhere the API runs (still required)

The Vercel function (`api/index.py`) has no `ENVIRONMENT` set anywhere in the repo.
Without it the API runs in development mode: in-memory database allowed, verbose error
messages, Swagger docs exposed, and (before this fix) a hard-coded admin signing secret.
On every host (Render, Vercel, Docker) set:

```
ENVIRONMENT=production
ADMIN_SESSION_SECRET=<32+ random chars: python3 -c "import secrets; print(secrets.token_urlsafe(48))">
MONGODB_URI=...
FRONTEND_ORIGINS=https://<your-frontend-domain>
GOOGLE_CLIENT_ID=...
ADMIN_EMAILS=...
SMTP_USER=... / SMTP_PASSWORD=... / SMTP_FROM_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_JSON=<new key JSON>
GOOGLE_SHEETS_SPREADSHEET_ID=...
```

Production now refuses to start if `ADMIN_SESSION_SECRET` is missing, shorter than 32
characters, or one of the known placeholder strings, so a misconfigured deploy fails
loudly instead of running with a forgeable admin login.

---

## Findings

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | **Critical** | Google service-account private key and spreadsheet ID committed in `backend/.env.example` (also baked into the Docker image, since `.env.example` is not in `.dockerignore`). | Accepted risk (private repo). Dead config removed from template. |
| 2 | **High** | Admin session signing secret could be a publicly known constant. The code fell back to `development-admin-session-secret`, and `make env` copies the template value `replace-with-another-long-random-secret` into `backend/.env`, which passed the production "is it set" check. Anyone knowing the value can forge a session for any email in `ADMIN_EMAILS` and get full admin access. | Fixed |
| 3 | **High** | `cryptography` is imported by the Google Sheets sync but was not in `requirements.txt`. A clean deploy (Render build, Docker image) crashes at import, and the test suite could not even be collected. | Fixed |
| 4 | Medium | Spreadsheet formula injection in all three Excel exports (attendance, scheduler, master backup). openpyxl stores a string starting with `=` as a live formula, so a participant registering as `=HYPERLINK("http://evil","...")` gets it executed when an organizer opens the file. The CSV export already escaped this; the xlsx exports did not. Verified with a proof-of-concept. | Fixed |
| 5 | Medium | Google login checked `profile.get("email_verified")` for truthiness, but Google's tokeninfo endpoint returns the **string** `"false"`, which is truthy. Unverified accounts passed the check. | Fixed |
| 6 | Medium | Per-IP rate limiting did not work in any real deployment. Uvicorn only trusts `X-Forwarded-For` from 127.0.0.1, and Render's proxy and the nginx container connect from other addresses, so every visitor shared one bucket. One person sending 30 requests/minute locked registration for the whole campus. | Fixed: Uvicorn trusts the proxy via `FORWARDED_ALLOW_IPS` (default `*`). Do not expose port 4000 directly while this is `*`. |
| 7 | Medium | SQLite persistence never initialised on a fresh database (`ALTER TABLE` ran before `CREATE TABLE`), and the `admin_actions` table was never created. The service silently fell back to in-memory storage, so registrations and the admin audit log vanished on restart whenever Mongo was not configured. This is why 2 existing tests failed. | Fixed |
| 8 | Low | Swagger UI, ReDoc and `/openapi.json` were public in production, enumerating every admin route. | Fixed: disabled in production |
| 9 | Low | The public boarding-pass endpoint `GET /api/p/{token}` returned the participant's email, which the pass page never displays. | Fixed: removed |
| 10 | Low | `Idempotency-Key` header was stored and uniquely indexed with no length limit. | Fixed: capped at 128 chars |
| 11 | Low | nginx allowed 20 MB request bodies to the API, which parses JSON fully in memory on a 512 MB container. | Fixed: 1 MB for `/api/` |
| 12 | Low | `GET /api/admin/events` had `@limiter.limit` above `@router.get`, so the limit was never applied. | Fixed: order corrected, set to 60/minute so the admin UI is not throttled |
| 13 | Info | Anyone holding a pass QR token can call `POST /api/p/{token}/check-in` from anywhere, with no staff involvement. A photo of a pass is enough to burn or spoof a check-in. This is a design choice; if check-in should only happen at the gate, remove the public check-in route and use the admin scanner only. | Open (design decision) |
| 14 | Info | The QR printed on the boarding pass encodes the **registration ID**, not the high-entropy `qrToken` (`boarding_pass_service.py`, `qr_payload`). The public `/p/{token}` page rejects registration IDs, so it is unreachable from the QR, and the token flow is effectively unused. Admin scanning still works because the admin lookup accepts IDs. Decide which you want and align the two. | Open |
| 15 | Info | No `Content-Security-Policy` header on the frontend (nginx or Vercel). React's escaping is the only XSS defence. Adding a CSP needs allowances for Google Fonts, Google Identity, and MapLibre tiles, so it was not added blind. | Open |
| 16 | Info | A personal UPI ID and payee name are hard-coded as fallbacks in `RegistrationModal.jsx` (line 99). If `VITE_UPI_ID` is ever unset, payments go to that person. Prefer failing closed. | Open |
| 17 | Info | Coordinator phone numbers and personal Gmail addresses ship in the public JS bundle (`site.js`, `coordinators.js`). Fine if consented; worth confirming. | Open |
| 18 | Info | Routers are mounted twice (`/api/...` and unprefixed `/...`, `/admin/...`) for Vercel. Each copy has its own rate-limit bucket, so effective limits are doubled. Remove the unprefixed mount if Vercel routing does not need it. | Open |
| 19 | Info | `playwright` is not in `requirements.txt`, so boarding-pass and receipt images cannot render on a clean deploy and pass emails fail. Not a security issue, but it will bite on event day. | Open |
| 20 | Info | `vite.config.js` `allowedHosts` includes a personal ngrok hostname. Dev-only, harmless, but noise. | Open |
| 21 | Info | An `Authorization: Bearer` path exists alongside cookie auth and the frontend never uses it. Smaller surface if removed. | Open |
| 22 | Medium | Rate limiter state is per process (`memory://`) while production defaults to several Uvicorn workers, so every documented limit is silently multiplied by the worker count and 429s become intermittent. | Open |
| 23 | Low | Admin sessions cannot be revoked individually; logout only clears the cookie, and owner sessions stay valid for 8 hours. The only kill switch is rotating the signing secret for everyone. | Open |
| 24 | Low | nginx security headers are declared in the `server {}` block but `add_header` is not inherited into locations that set their own headers, so `index.html` and all static assets are served without them. Vercel sets no security headers at all. nginx listens on 443 with no certificate configured. | Open |

Items 13–24 each have a detailed write-up, recommended design, verification steps, and a ready-to-paste fix prompt in [SECURITY_OPEN_ITEMS.md](SECURITY_OPEN_ITEMS.md).

## What was checked and found sound

- CORS uses an explicit allowlist with no regex; credentialed requests from other origins are rejected.
- CSRF: the token is embedded in the HMAC-signed session and required as `X-CSRF-Token` on every non-GET admin request, compared in constant time. The cookie is `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS.
- Admin tokens are HMAC-SHA256 signed, expire after 8 hours, and every request re-resolves tab permissions from the database, so revoking a delegate takes effect immediately.
- All Mongo `$regex` queries built from user input go through `re.escape`. SQLite uses parameter binding; table names are internal constants.
- Every value rendered into email HTML and into the Playwright-rendered pass/receipt is passed through `html.escape`.
- The React frontend has no `dangerouslySetInnerHTML`, no `eval`, and all admin calls go through one `adminFetch` wrapper that attaches credentials and the CSRF header.
- Registration fees, event IDs, team sizes, UTR format, and duplicate checks are all enforced server-side; the client cannot set price or payment status.
- Registration IDs have ~60 bits of entropy and QR tokens 144 bits, generated independently with `secrets`.
- Unhandled exceptions return a generic message in production and are logged with stack traces server-side.
- Docker runs the API as a non-root user; the backend port is not published, only nginx is.

## Files changed

| File | Change |
|------|--------|
| `backend/.env.example` | Removed private key and spreadsheet ID; documented `ADMIN_SESSION_SECRET`, `FORWARDED_ALLOW_IPS`, SMTP, and Sheets variables |
| `backend/requirements.txt`, `requirements.txt` | Added `cryptography>=43.0.0` |
| `backend/app/core/config.py` | `resolve_admin_session_secret()`: placeholder/length enforcement in production, random per-process secret otherwise; `forwarded_allow_ips` setting |
| `backend/app/routes/admin_routes.py` | String-safe `email_verified` check; fixed `/events` rate-limit decorator order |
| `backend/app/main.py` | Docs/OpenAPI disabled in production |
| `backend/app/routes/public_routes.py` | `Idempotency-Key` capped at 128 chars; email removed from public pass payload |
| `backend/app/services/export_service.py` | `_neutralize_formulas()` applied before every workbook save |
| `backend/app/db/sqlite_db.py` | Tables created before column migration; `admin_actions` table created |
| `backend/run.py` | `proxy_headers=True`, `forwarded_allow_ips` from settings |
| `frontend/nginx.conf` | `client_max_body_size 1m` on `/api/` |
| `backend/tests/test_security_fixes.py` | New: 13 regression tests |
| `BACKEND.md` | Security section updated to match the code |

## Running the tests

```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
ALLOW_MEMORY_DB=true ENVIRONMENT=development REGISTRATION_OPEN=true python -m pytest tests/ -q
```
