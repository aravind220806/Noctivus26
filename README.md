# Noctivus '26

A fast, mobile-first symposium website with a React/Vite frontend and a Python/FastAPI MongoDB registration API.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the current system architecture. The implemented payment flow is UPI QR/deep-link plus manual UTR verification, not Razorpay.

## What is included

- Dark Noctivus visual identity based on the 2025 edition
- Local, lightweight React Bits–inspired effects (no Motion, Three.js, WebGL, or canvas loops)
- Responsive floating navigation, hero, event cards and accessible event dialogs
- Schedule, brochure/transport placeholders, FAQ, contacts, and social links
- Multi-step solo/team registration flow
- Dynamic UPI deep link and lazy-loaded QR generation
- Server-authoritative fee validation, UTR validation, duplicate checks, and pending verification
- Protected organizer status endpoint and optional confirmation email through Resend
- MongoDB persistence with an explicit in-memory development fallback

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
3. Set `MONGODB_URI`, `FRONTEND_ORIGINS`, and a long random `ORGANIZER_SECRET` in the backend host.
4. Keep `REGISTRATION_OPEN=false` during setup. Change it to `true` only after a real payment and database test.
5. Configure `RESEND_API_KEY` and `CONFIRM_FROM` if confirmation emails are required.
6. Replace the brochure, transport, and coordinator placeholders after organizers approve them.

Never commit `.env` files or expose the organizer secret in the React frontend.

For local development, the backend automatically loads `atlas-credentials.env` from the project root when present. That file is ignored by Git. A different location can be supplied through `ATLAS_CREDENTIALS_FILE`.

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
- `PATCH /api/registrations/{id}` with `Authorization: Bearer <ORGANIZER_SECRET>`
