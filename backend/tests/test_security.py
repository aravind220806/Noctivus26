"""
Security regression tests — these MUST remain passing.
A failure here means a security control has regressed.
"""
import os
import time
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.setdefault("ALLOW_MEMORY_DB", "true")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("REGISTRATION_OPEN", "true")

import pytest
from fastapi.testclient import TestClient

from app.middleware.admin_auth import sign_admin_token, verify_admin_token
from app.db.memory_store import memory_registrations


def get_client():
    from app.main import app
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# P0.1 — CORS: untrusted origins must be rejected in all modes
# ---------------------------------------------------------------------------

def test_cors_rejects_untrusted_origin_in_production():
    """
    allow_origin_regex=None so evil.vercel.app is strictly blocked.
    We verify against main.py's CORS configuration.
    """
    client = get_client()
    resp = client.options(
        "/api/events",
        headers={"Origin": "https://evil.vercel.app", "Access-Control-Request-Method": "GET"},
    )
    acao = resp.headers.get("access-control-allow-origin", "")
    assert acao != "https://evil.vercel.app", f"CORS allowed untrusted origin: {acao}"


def test_cors_regex_is_none_in_production_config():
    """CORSMiddleware is configured with explicit allowlist and no wildcard regex."""
    from app.main import app
    from fastapi.middleware.cors import CORSMiddleware

    cors_middleware = next((m for m in app.user_middleware if m.cls == CORSMiddleware), None)
    assert cors_middleware is not None, "CORSMiddleware not found in app"
    assert cors_middleware.kwargs.get("allow_origin_regex") is None, "allow_origin_regex must be None"
    assert cors_middleware.kwargs.get("allow_credentials") is True


def test_cors_allows_trusted_origin():
    """Preflight from the configured frontend origin must succeed."""
    client = get_client()
    resp = client.options(
        "/api/events",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    acao = resp.headers.get("access-control-allow-origin", "")
    assert acao == "http://localhost:5173", f"Expected trusted origin reflected, got: {acao}"


# ---------------------------------------------------------------------------
# P0.1 — CSRF: mutating admin requests without token must be rejected
# ---------------------------------------------------------------------------

def _make_admin_token():
    user = {
        "email": "test@example.com",
        "name": "Test Admin",
        "picture": "",
        "tabs": ["Registrations"],
        "owner": False,
    }
    return sign_admin_token(user)


def test_csrf_required_on_mutating_admin_request():
    """A POST to an auth-guarded endpoint with a valid session but no X-CSRF-Token must get 403."""
    token, _csrf = _make_admin_token()
    # Patch where admin_auth.py imported resolve_admin_access, not the source module.
    with patch("app.middleware.admin_auth.resolve_admin_access", new=AsyncMock(return_value={"tabs": ["Check-in"], "owner": False})), \
         patch("app.middleware.admin_auth.session_exists", new=AsyncMock(return_value=True)):
        client = TestClient(get_client().app, raise_server_exceptions=False)
        client.cookies.set("noctivus_admin_session", token)
        resp = client.post(
            "/api/admin/walk-ins",
            json={"participant": {"name": "test"}, "eventId": "x"},
            # Intentionally omitting X-CSRF-Token
        )
    assert resp.status_code == 403, f"Expected 403 for missing CSRF, got {resp.status_code}: {resp.text}"
    assert "CSRF" in resp.text or "csrf" in resp.text.lower(), f"Response should mention CSRF: {resp.text}"


def test_csrf_accepted_with_correct_token():
    """A POST with a valid session AND matching X-CSRF-Token must not be rejected for CSRF."""
    token, csrf = _make_admin_token()
    with patch("app.middleware.admin_auth.resolve_admin_access", new=AsyncMock(return_value={"tabs": ["Check-in"], "owner": False})), \
         patch("app.middleware.admin_auth.session_exists", new=AsyncMock(return_value=True)):
        client = TestClient(get_client().app, raise_server_exceptions=False)
        client.cookies.set("noctivus_admin_session", token)
        resp = client.post(
            "/api/admin/walk-ins",
            json={"participant": {"name": "test"}, "eventId": "x"},
            headers={"x-csrf-token": csrf},
        )
    # CSRF passed — any non-403 response (even 422/404 for missing DB data) is acceptable
    assert resp.status_code != 403, f"Correct CSRF token was rejected: {resp.status_code}: {resp.text}"


# ---------------------------------------------------------------------------
# P0.2 — Public check-in rejects bare registration IDs
# ---------------------------------------------------------------------------

def test_public_checkin_rejects_registration_id():
    """POST /api/p/{registrationId}/check-in must not find registrations by their ID."""
    client = get_client()
    memory_registrations.clear()
    memory_registrations.append({
        "registrationId": "NOC26-AABBCC",
        "qrToken": "validqrtokenthatislong",
        "qrHash": "somehash",
        "paymentStatus": "confirmed",
        "checkedIn": False,
        "participant": {"name": "Test", "email": "t@t.com"},
        "eventRegistrations": [],
    })
    resp = client.post("/api/p/NOC26-AABBCC/check-in")
    assert resp.status_code in (401, 403, 404), (
        f"Registration ID accepted on public check-in: {resp.status_code}"
    )
    memory_registrations.clear()


def test_public_pass_rejects_registration_id():
    """GET /api/p/{registrationId} must not expose PII via a bare registration ID."""
    client = get_client()
    memory_registrations.clear()
    memory_registrations.append({
        "registrationId": "NOC26-AABBCC",
        "qrToken": "validqrtokenthatislong",
        "qrHash": "somehash",
        "paymentStatus": "confirmed",
        "checkedIn": False,
        "participant": {"name": "Test", "email": "t@t.com"},
        "eventRegistrations": [],
    })
    resp = client.get("/api/p/NOC26-AABBCC")
    assert resp.status_code in (401, 403, 404), (
        f"Registration ID accepted on public pass GET: {resp.status_code}"
    )
    memory_registrations.clear()


def test_public_checkin_disabled_by_default_for_qr_token():
    """Self check-in is disabled by default even with a valid high-entropy QR token."""
    client = get_client()
    qr_token = "ValidHighEntropyToken_1234567890AB"
    memory_registrations.clear()
    memory_registrations.append({
        "registrationId": "NOC26-AABBCC",
        "qrToken": qr_token,
        "qrHash": "anyhash",
        "paymentStatus": "confirmed",
        "checkedIn": False,
        "participant": {"name": "Test", "email": "t@t.com"},
        "eventRegistrations": [],
        "invitation": {"qrToken": qr_token, "qrHash": "anyhash"},
    })
    resp = client.post(f"/api/p/{qr_token}/check-in")
    assert resp.status_code == 403, f"Self check-in should be disabled by default: {resp.status_code} {resp.text}"
    assert memory_registrations[0]["checkedIn"] is False
    memory_registrations.clear()


def test_public_checkin_flag_accepts_qr_token():
    """POST /api/p/{qrToken}/check-in works only when self check-in is explicitly enabled."""
    client = get_client()
    qr_token = "ValidHighEntropyToken_1234567890AB"
    memory_registrations.clear()
    memory_registrations.append({
        "registrationId": "NOC26-AABBCC",
        "qrToken": qr_token,
        "paymentStatus": "confirmed",
        "checkedIn": False,
        "participant": {"name": "Test", "email": "t@t.com"},
        "eventRegistrations": [],
        "invitation": {"qrToken": qr_token},
    })
    with patch("app.routes.public_routes.settings.public_self_checkin_enabled", True), \
         patch("app.services.registration_service.sqlite_db.ready", return_value=False):
        resp = client.post(f"/api/p/{qr_token}/check-in")
    assert resp.status_code == 200, f"Valid QR token rejected: {resp.status_code} {resp.text}"
    assert resp.json()["registration"]["checkedInBy"] == "self"
    memory_registrations.clear()


def test_boarding_pass_qr_encodes_verification_url(monkeypatch):
    """The QR payload must point to /p/<token>, not the human-readable registration ID."""
    from app.services import boarding_pass_service as bps
    captured = {}

    def fake_qr_data_uri(payload):
        captured["payload"] = payload
        return "data:image/png;base64,abc"

    monkeypatch.setattr(bps, "qr_data_uri", fake_qr_data_uri)
    token = "HighEntropyToken_1234567890"
    html = bps.render_boarding_pass_html(
        {"registrationId": "NOC26-HUMANID", "participant": {"name": "Test"}},
        {},
        token,
    )
    assert "data:image/png;base64,abc" in html
    assert captured["payload"] == bps.verification_url(token)


# ---------------------------------------------------------------------------
# P0.3 — QR token generated separately from registration ID
# ---------------------------------------------------------------------------

def test_qr_token_is_independent_of_registration_id():
    """create_qr_token() must return a high-entropy value not derived from the registration ID."""
    from app.services.registration_service import create_registration_id, create_qr_token
    reg_id = create_registration_id()
    qr_token, qr_hash = create_qr_token()
    assert reg_id not in qr_token, "QR token must not contain the registration ID"
    assert qr_token not in reg_id, "Registration ID must not contain the QR token"
    assert len(qr_token) >= 24, f"QR token entropy too low: {len(qr_token)} chars"


# ---------------------------------------------------------------------------
# P1.4 — Health reports SQLite-backed runtime state
# ---------------------------------------------------------------------------

def test_health_reports_sqlite_runtime():
    """GET /api/health returns the SQLite-backed runtime state."""
    client = get_client()
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("database") == "sqlite"


# ---------------------------------------------------------------------------
# P1.5 — Rate limits match BACKEND.md documentation
# ---------------------------------------------------------------------------

def test_rate_limits_match_documentation():
    """
    BACKEND.md specifies 30/minute for registration and 60/minute for UTR check.
    This test inspects the source to confirm the decorators match.
    Fails immediately if inflated limits (1000/min, 1200/min) reappear.
    """
    import inspect
    import app.routes.public_routes as pr

    source = inspect.getsource(pr)
    assert '"30/minute"' in source or "'30/minute'" in source, \
        "30/minute registration rate limit not found in public_routes.py"
    assert '"60/minute"' in source or "'60/minute'" in source, \
        "60/minute UTR check rate limit not found in public_routes.py"
    assert "1000/minute" not in source, \
        "Inflated 1000/minute registration limit is still present — security regression"
    assert "1200/minute" not in source, \
        "Inflated 1200/minute UTR limit is still present — security regression"


def test_worker_config_requires_redis_for_multiworker_production():
    from app.core.config import validate_worker_config

    with pytest.raises(RuntimeError):
        validate_worker_config("production", 2, "")
    validate_worker_config("production", 2, "redis://redis:6379/0")
    validate_worker_config("production", 1, "")


def test_authorization_bearer_is_not_admin_auth():
    token, _csrf = _make_admin_token()
    with patch("app.middleware.admin_auth.resolve_admin_access", new=AsyncMock(return_value={"tabs": ["Registrations"], "owner": False})), \
         patch("app.middleware.admin_auth.session_exists", new=AsyncMock(return_value=True)):
        client = TestClient(get_client().app, raise_server_exceptions=False)
        bearer_resp = client.get("/api/admin/me", headers={"Authorization": f"Bearer {token}"})
        client.cookies.set("noctivus_admin_session", token)
        cookie_resp = client.get("/api/admin/me")

    assert bearer_resp.status_code == 401
    assert cookie_resp.status_code == 200


# ---------------------------------------------------------------------------
# P1.6 — Unhandled exceptions must not leak internal details in production
# ---------------------------------------------------------------------------

def test_unhandled_exception_hides_details_in_production():
    """An unhandled server-side exception must not expose str(error) in production."""
    import app.main as main_module
    original_env = main_module.settings.environment

    def boom():
        raise RuntimeError("super secret internal DB connection string and stack trace")

    try:
        main_module.settings.environment = "production"
        client = get_client()
        with patch("app.routes.public_routes.registration_status", new=AsyncMock(side_effect=RuntimeError("super secret internal DB connection string"))):
            resp = client.get("/api/events")
        body = resp.text
        assert "super secret" not in body, f"Internal error details leaked to client: {body}"
    finally:
        main_module.settings.environment = original_env


# ---------------------------------------------------------------------------
# P1.7 — Idempotency key prevents duplicate registrations
# ---------------------------------------------------------------------------

def test_idempotency_key_prevents_duplicate_registration():
    """Two POST /api/register calls with the same Idempotency-Key must produce only one record."""
    memory_registrations.clear()
    client = get_client()

    payload = {
        "participant": {
            "name": "Test User",
            "email": "idempotency@test.com",
            "phone": "9876543210",
            "college": "Test College",
        },
        "eventRegistrations": [],
        "utrNumber": "123456789012",
        "claimedAmount": 0,
    }
    key = "unique-idempotency-key-abc123"

    with patch("app.services.registration_service.validate_registration", return_value={
        "valid": True,
        "value": {
            "participant": payload["participant"],
            "eventRegistrations": [],
            "normalizedUtr": "123456789012",
            "normalized": {"email": "idempotency@test.com"},
            "utrNumber": "123456789012",
            "claimedAmount": 0,
            "expectedAmount": 0,
        },
        "errors": [],
    }), patch("app.services.registration_service.settings") as mock_settings:
        mock_settings.registration_open = True
        mock_settings.node_env = "development"
        mock_settings.allow_memory_db = True

        with patch("app.services.event_service.list_events", new=AsyncMock(return_value=[])):
            resp1 = client.post("/api/register", json=payload, headers={"Idempotency-Key": key})
            resp2 = client.post("/api/register", json=payload, headers={"Idempotency-Key": key})

    matching = [r for r in memory_registrations if r.get("idempotencyKey") == key]
    assert len(matching) <= 1, f"Idempotency key allowed duplicate: {len(matching)} records created"
    memory_registrations.clear()


# ---------------------------------------------------------------------------
# CSRF token validity
# ---------------------------------------------------------------------------

def test_sign_and_verify_includes_csrf():
    """sign_admin_token returns a CSRF token that is embedded in the verified session."""
    user = {"email": "a@b.com", "name": "A", "picture": "", "tabs": [], "owner": False}
    token, csrf = sign_admin_token(user)
    data = verify_admin_token(token)
    assert data is not None
    assert data.get("csrf") == csrf, "CSRF token in session does not match what was returned at login"
