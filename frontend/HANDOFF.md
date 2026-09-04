# Frontend Handoff — Noctivus Admin Panel

This document is a briefing for the next developer (or Claude session) picking
up frontend work. Read it top to bottom before touching any code.

---

## Headers rollout

nginx and Vercel currently send `Content-Security-Policy-Report-Only`. Before
switching to enforcing `Content-Security-Policy`, open and check the browser
console on home, the registration payment step, `/login`, `/admin` including
scanner camera access, `/p/<token>`, `/coordinators`, and the venue map. Fix any
CSP reports first, then rename the header.

---

## What just changed on the backend (and why the frontend had to move too)

A full security remediation was completed on the backend (see
`backend/CLAUDE.md` for the full specification, `backend/tests/test_security.py`
for the regression tests). The changes that affect the frontend are:

### 1. Admin login now returns a CSRF token

Every login endpoint (`POST /api/admin/auth/google`, `POST /api/admin/auth/dev`)
now returns a `csrfToken` field in the JSON response body alongside `user`:

```json
{
  "user": { "email": "...", "tabs": [...], "owner": false },
  "csrfToken": "a3f8b2c1d4e5f6..."
}
```

**Every state-changing admin request (POST, PATCH, PUT, DELETE) must now include
this token as the `X-CSRF-Token` header.** Requests that are missing it or have
a wrong value get a `403 CSRF token missing or invalid.` response. GET requests
are exempt.

### 2. Cookie SameSite changed from `None` to `Lax`

The `noctivus_admin_session` cookie is now `SameSite=Lax`. No frontend action
needed — this is invisible to JS — but it means cross-site form submits no
longer carry the cookie (which was the point).

### 3. Public pass/check-in no longer accepts registration IDs

`GET /api/p/{id}` and `POST /api/p/{id}/check-in` only accept the high-entropy
QR token. Registration IDs like `NOC26-AABBCC` now return 404 on these routes.
The QR codes embedded in boarding passes already use the token, so this only
matters if you were doing manual URL construction.

---

## What was already done to wire CSRF into the frontend

**`frontend/src/admin/AdminApp.jsx`** — two changes:

```jsx
// 1. Added csrfToken state
const [csrfToken, setCsrfToken] = useState('');

// 2. authHeaders now includes the token (was always {} before)
const authHeaders = useMemo(
  () => (csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
  [csrfToken],
);

// 3. saveSession stores the token from the login response
const saveSession = (data) => {
  setSession(data);
  if (data?.csrfToken) setCsrfToken(data.csrfToken);
};
```

`authHeaders` is already passed as a prop to every tab component, and every
tab component already spreads `authHeaders` into its fetch calls like:

```js
adminFetch(apiPath('/api/admin/something'), {
  method: 'POST',
  headers: { ...authHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

So the CSRF header propagates automatically to all tab components without
touching them individually.

---

## What you still need to verify / finish

### Priority 1 — Test the login flow manually

The CSRF token is only available after a successful login. Page-refresh
sessions (where `GET /api/admin/me` re-validates the cookie) do NOT return a
new CSRF token — the token lives in the session tab, not in localStorage.

**This means: after a hard page refresh, `csrfToken` state resets to `''`
and all mutating requests will fail with 403.**

You need to fix this. Two options:

**Option A (recommended) — re-fetch CSRF token from /me:**
Add a `csrfToken` field to the `GET /api/admin/me` response on the backend so
the client can re-hydrate on page load. Then in `AdminApp.jsx`'s startup
`useEffect`, read it:

```js
adminFetch(apiUrl('/api/admin/me'))
  .then((r) => (r.ok ? r.json() : null))
  .then((data) => {
    if (data?.user) setSession({ user: data.user });
    if (data?.csrfToken) setCsrfToken(data.csrfToken);  // add this
    setAuthChecked(true);
  });
```

And in the backend `/me` route (`admin_routes.py`):
```python
@router.get("/me")
async def me(admin=Depends(require_admin)):
    return {"user": admin, "tabs": admin["tabs"], "csrfToken": admin["csrf"]}
```

**Option B — store CSRF token in sessionStorage:**
In `saveSession`, also do `sessionStorage.setItem('csrfToken', data.csrfToken)`.
On mount in `AdminApp`, read it back. Clear on logout. This avoids the backend
change but uses `sessionStorage` (survives page refresh within the same tab,
lost on tab close).

### Priority 2 — Verify the ExportTab GET → no CSRF needed

`GET /api/admin/export` opens a file download. It uses `window.location.href`
or an anchor tag, not `adminFetch`. This is fine — GET requests are CSRF-exempt
on the backend. No change needed; just confirm it still works end-to-end.

### Priority 3 — Logout should send CSRF (future hardening)

The `POST /api/admin/logout` route on the backend currently has no
`require_admin` dependency, so it doesn't check CSRF. The cookie is just
deleted unconditionally. This means a CSRF-logout attack (forcing an admin to
log out) is theoretically possible, though low-impact. If you want to harden:

Backend: add `Depends(require_admin)` to the logout route.
Frontend: the `logout()` function in `AdminApp.jsx` already has access to
`authHeaders` (it's in scope), so:

```js
await adminFetch(apiUrl('/api/admin/logout'), {
  method: 'POST',
  headers: authHeaders,  // add this
});
```

---

## Architecture — where things live

| What | File |
|---|---|
| API base URL helper | `frontend/src/lib/api.js` |
| Admin fetch wrapper + authHeaders type | `frontend/src/admin/adminUtils.js` |
| Session state, CSRF state, authHeaders | `frontend/src/admin/AdminApp.jsx` |
| Login (Google OAuth + dev shortcut) | `frontend/src/admin/components/AdminLogin.jsx` |
| All tab components | `frontend/src/admin/components/` |

The `authHeaders` object flows top-down: `AdminApp` owns it, passes it as a
prop to every tab, and tabs spread it into every `adminFetch` call. Do not
build a separate auth context or store CSRF in a global — keep it in
`AdminApp`'s state.

---

## Known gaps (from BACKEND.md and CLAUDE.md P2 backlog)

These are out of scope for this handoff but should be tracked:

- Google Sheets mirror is not implemented (backend stub only).
- Redis-backed rate limiting is not configured — in-memory limiter doesn't
  share state across multiple Render workers. Set `REDIS_URL` when scaling.
- Admin session revocation: there is no per-token revoke. Rotating
  `ADMIN_SESSION_SECRET` invalidates all sessions at once.
- `POST /api/admin/auth/dev` should be gated by an `ENABLE_DEV_AUTH` env flag
  (currently only gated by `environment != production`).

---

## How to run locally

```bash
make install          # creates .venv, pip installs backend, npm installs frontend
make dev-api          # FastAPI on :4000  (in one terminal)
make dev-frontend     # Vite on :5173     (in another terminal)
make test             # compile-check + 15 security regression tests
```

Copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` →
`frontend/.env` before starting. The backend uses SQLite by default; set
`ALLOW_MEMORY_DB=true` only for temporary in-memory fallback testing.
