# Noctivus '26

A fast, mobile-first symposium website with a React/Vite frontend and a Python/FastAPI SQLite registration API.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the current system architecture. The implemented payment flow is UPI QR/deep-link plus manual UTR verification, not Razorpay.

## What is included

- Dark Noctivus visual identity based on the 2025 edition
- Local, lightweight React Bits–inspired effects (no Motion, Three.js, WebGL, or canvas loops)
- Responsive floating navigation, hero, event cards and accessible event dialogs
- Schedule, brochure/transport placeholders, FAQ, contacts, and social links
- Multi-step solo/team registration flow
- Dynamic UPI deep link and lazy-loaded QR generation
- Server-authoritative fee validation, UTR validation, duplicate checks, and pending verification
- Protected admin verification and optional confirmation email through Resend
- SQLite persistence with an explicit in-memory development fallback

## Run locally

```bash
npm install
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cd ..
npm run dev:api
```

In another terminal:

```bash
npm run dev
```

Open `http://localhost:5173`.

For local registration testing, set `ALLOW_MEMORY_DB=true` and `REGISTRATION_OPEN=true` in `backend/.env`. Memory records disappear whenever the backend restarts.

`npm run dev:api` starts the Python/FastAPI backend.

## Required before launch

1. Replace the placeholder content and event data in `frontend/src/data/site.js` with the approved date, contacts, schedule, fees, rules, and links.
2. Set the real `VITE_UPI_ID`, `VITE_UPI_PAYEE`, and deployed `VITE_API_URL` in the frontend host.
3. Set `SQLITE_DB_PATH`, `FRONTEND_ORIGINS`, and a long random `ADMIN_SESSION_SECRET` in the backend host. Production refuses to start without a strong admin-session secret.
4. Keep `REGISTRATION_OPEN=false` during setup. Change it to `true` only after a real payment and database test.
5. Configure `RESEND_API_KEY` and `CONFIRM_FROM` if confirmation emails are required.
6. Replace the brochure, transport, and coordinator placeholders after organizers approve them.

Never commit `.env` files or expose the admin session secret in the React frontend.

Render is configured with one Uvicorn worker for a free/starter-tier host. Set `WEB_CONCURRENCY` to `2` or higher only when the backend instance has multiple CPU cores. Local development keeps one reload-enabled worker. Public registration and UTR-check limits are per source IP to protect shared networks without blocking normal event traffic.


## Verification

```bash
npm run build
npm test
```

The QR library is loaded as a separate chunk only when the payment step opens. The current main production JavaScript bundle is approximately 72 KB compressed.

## API summary

- `GET /api/health`
- `GET /api/events`
- `POST /api/register`
