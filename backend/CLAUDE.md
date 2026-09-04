# CLAUDE.md — NOCTIVUS Backend Remediation

This file governs how Claude Code should work in this repository until the
items below are resolved. The backend was security-reviewed and found
**not production-safe** (see `docs/security-review.md`, copied in from the
QA report — commit it if it doesn't exist yet). Your job is to fix it, in
priority order, without breaking the working parts.

Read this whole file before touching code. Do not start editing until you
have located every file referenced below (search for the class/function
names, not just the filenames — they may have moved).

## How to work in this repo

- Work one priority tier at a time (P0 → P1 → P2, defined below). Do not
  jump ahead to P1 items while a P0 item is unfixed unless a P1 fix is a
  prerequisite for a P0 fix.
- For each item: make the code change, then write or update the automated
  test that proves it, then run the test. Do not mark an item done in your
  final summary unless its test actually passed in this session.
- After each tier, give me a short status report: what changed, which
  files, which tests were added, and what's still open. Do not give me a
  running narration of every intermediate step — just the per-tier summary.
- If a fix requires a decision only the product owner can make (e.g. the
  Razorpay-vs-UPI architecture question in P1.7), stop and ask instead of
  guessing. Everything else, use your judgment and proceed.
- Never weaken a security control to make a test pass. If a test is hard
  to satisfy, the fix is incomplete, not the test.
- Preserve existing behavior that isn't called out below — this is a
  remediation pass, not a rewrite. Don't reformat files you aren't
  otherwise editing.

## P0 — fix immediately, in this order

### P0.1 — Credentialed CORS / CSRF (HIGH)

**File:** `main.py` (CORS middleware setup), plus wherever the admin
session cookie is set (`set_cookie(...)`, look for `samesite="none"`).

Current state: `allow_credentials=True` is combined with
`allow_origin_regex` matching any `*.vercel.app` / `*.ngrok-free.app`
subdomain, and the admin cookie uses `samesite="none"`. Combined, any
attacker-controlled Vercel deployment can make credentialed cross-origin
requests against every admin endpoint using the victim's session cookie.
There is no CSRF token.

Do this:
1. Replace `allow_origin_regex` with an explicit `allow_origins` allowlist
   read from a settings/env value (e.g. `FRONTEND_ORIGINS`), one exact
   origin per entry — no wildcards, no regex, in production. Keep the
   permissive regex, if you keep it at all, gated strictly behind
   `settings.environment != "production"` for local/staging convenience.
2. Change the admin cookie's `SameSite` attribute to `Lax` (or `Strict` if
   the login flow tolerates it) unless you can name the specific
   cross-site flow that requires `None`. If a specific flow needs `None`,
   document it inline as a comment and add CSRF protection for it (step 3).
3. Add CSRF protection for every cookie-authenticated state-changing route
   (anything other than GET/HEAD/OPTIONS under an authenticated path).
   Use a double-submit token or a synchronizer token issued at login and
   required on mutating requests via a custom header (not a form field, so
   it survives JSON APIs). Reject requests missing or mismatching it with
   403.
4. Write a test (or a set of tests) that sends credentialed requests from
   a disallowed origin (e.g. `https://evil.vercel.app`) to at least one
   GET and one state-changing admin endpoint, and asserts the browser-side
   preflight / CORS headers do NOT permit them, and that a same-origin
   request without a valid CSRF token on a mutating endpoint is rejected.
   These tests must be a hard CI failure if they regress — mark them
   clearly (e.g. `test_cors_rejects_untrusted_origin`).

### P0.2 — Public check-in accepts registration IDs (HIGH)

**File:** wherever `POST /api/p/{token_or_id}/check-in` and
`GET /api/p/{token_or_id}` are defined, and the lookup function that
accepts `registrationId`, QR token, or QR hash interchangeably.

Current state: the public, unauthenticated check-in endpoint treats a
6-hex-character registration ID (24 bits of entropy, format
`NOC26-{hex6}`) as equally valid to the cryptographic QR token. That
means registration IDs — which are meant to be human-readable
identifiers, not secrets — function as a check-in credential, and they're
brute-forceable. The same lookup also returns PII (name, college, email,
payment status) for whatever identifier is supplied.

Do this:
1. Split the lookup into two paths:
   - A public path that accepts **only** the high-entropy QR token.
   - An authenticated staff path that accepts the registration ID, gated
     behind the existing admin auth/authorization used elsewhere in the
     codebase.
2. Remove `registrationId` as an accepted input to any unauthenticated
   endpoint.
3. Confirm the public GET for a pass still only returns what's needed to
   render a pass/ticket — trim any fields beyond what the frontend
   actually displays, if you can determine that from `WORKFLOW.md` or the
   frontend code.
4. Write tests: registration ID alone must NOT authenticate a public
   check-in or public pass lookup (expect 401/403/404 — pick whichever
   the codebase's convention is for "not found or not authorized"); a
   valid QR token must still work end-to-end.

### P0.3 — Registration ID entropy (feeds P0.2)

**File:** wherever registration IDs are generated
(`secrets.token_hex(3)`).

This alone doesn't need to block P0.2 (once IDs aren't a credential,
their entropy stops being a security boundary), but do it anyway for
defense in depth. Do this:
1. Keep the human-facing registration ID format for display purposes, but
   generate the actual QR token separately with `secrets.token_urlsafe(16)`
   or a UUID4, and never derive one from the other.
2. Confirm nothing else in the codebase assumes the two are the same
   value or derivable from each other.

## P1 — after P0 is verified

### P1.4 — Mongo health/startup behavior

**File:** `connect_mongo()` and the app's lifespan/startup handler, and
the `/health` route.

Current state: a Mongo connection failure is swallowed (`client = None`,
`db = None`, no re-raise), the startup log still prints
"Connected to MongoDB" regardless of success, and `/health` always
returns `{"status": "ok"}`.

Do this:
1. Make `connect_mongo()` raise on failure, or return a status the caller
   checks — don't let the startup log claim success unconditionally.
2. Make `/health` actually ping Mongo (e.g. a lightweight `ping` command)
   and return `{"status": "degraded", "database": "unavailable"}` (or
   similar, matching this codebase's existing response conventions) when
   it can't reach the DB, with a non-200 status code so infra health
   checks (Render/Docker/K8s) correctly mark the instance unhealthy.
3. Decide, and document in code comments, whether a failed Mongo
   connection at startup should be fatal (crash the process) or degrade
   gracefully — either is defensible, but right now it silently does
   neither.
4. Test: simulate a Mongo connection failure (mock/patch the client) and
   assert `/health` reflects it.

### P1.5 — Rate limit code/doc mismatch

**File:** route decorators using `@limiter.limit(...)` on registration
and UTR endpoints, and `BACKEND.md`.

Current state: `BACKEND.md` documents 30/minute (registration) and
60/minute (UTR), but the code has `1000/minute` and `1200/minute`
respectively — effectively no protection.

Do this:
1. Set the actual limits to match the documented intent (30/minute
   registration, 60/minute UTR, per-IP), unless product wants different
   numbers — if so, update `BACKEND.md` to match instead of the other way
   around. Either way, code and docs must agree when you're done.
2. Add a rate-limit test per protected endpoint that sends N+1 requests
   and asserts the N+1th is rejected (429).

### P1.6 — Internal error leakage

**File:** the global exception handler (`detail = getattr(error,
"detail", None) or str(error)`).

Do this:
1. In production, return a fixed generic message (`"Internal server
   error."`) for unhandled exceptions — never `str(error)`. Keep
   `error.detail` passthrough only for exceptions you deliberately raise
   with safe, user-facing messages (e.g. `HTTPException`).
2. Log the real exception server-side (with stack trace) on every path
   that returns the generic message.
3. Test: trigger an unhandled exception in a route (e.g. via a mock that
   raises) and assert the response body contains no exception string,
   file path, or stack trace.

### P1.7 — Idempotency on registration submission

**File:** the registration POST handler.

Current state: duplicate protection is DB-uniqueness-based, not
request-idempotency-based, so a client retry after a timeout can look
like a second legitimate attempt.

Do this:
1. Accept an `Idempotency-Key` header on the registration endpoint.
   Persist the key alongside the resulting registration (or a short-TTL
   cache) and, on a repeat request with the same key, return the original
   result instead of attempting a new insert.
2. Test: submit the same request twice with the same idempotency key and
   assert only one registration is created and both responses match.

### P1.7b — Payment architecture decision (blocking — ask, don't guess)

`WORKFLOW.md` describes a Razorpay order/checkout/webhook flow.
`BACKEND.md` says the implementation is manual UPI + UTR verification and
explicitly states Razorpay isn't used. These are two different threat
models and API contracts. **Stop and ask me which one is authoritative**
before doing further payment-related work (including P1.5's UTR rate
limit, which only makes sense if UPI/UTR is the real design). Once I
confirm, update whichever of `WORKFLOW.md` / `BACKEND.md` is wrong so
they agree, and note the decision in your status report.

### P1.8 — Automated test baseline

Before closing out P1, make sure `slowapi` and any other missing test
dependencies are actually installed and `make test` / the test suite runs
clean in this environment — the original review couldn't execute the
runtime tests at all. If dependencies can't be resolved (no network,
version conflicts, etc.), tell me exactly what's blocking it rather than
skipping silently.

## P2 — remaining follow-up after P0 and P1 are complete

- Finish or explicitly descope the Google Sheets mirror workflow
  described in `WORKFLOW.md` but marked "not implemented" in
  `BACKEND.md` — ask me which, don't assume.
- Capacity/concurrency test: with capacity=1, fire 100 simultaneous
  registration requests and assert exactly 1 succeeds and the stored
  capacity counter matches reality afterward, including the
  multi-event reserve/release-on-failure path.
- Spreadsheet export escaping test for cells starting with `= + - @`
  (control appears already implemented — just needs a test).

## Definition of done for this pass

- Every P0 item has a passing regression test that would fail on the old
  code.
- `BACKEND.md`, `WORKFLOW.md`, and the code agree with each other on
  payment architecture and rate limits.
- `/health` reflects real Mongo state.
- No unhandled exception can reach a client with internal details.
- You've given me one status report per tier (P0, P1, P2), not per file
  or per commit.
