import os
from unittest.mock import patch, AsyncMock
import pytest
from fastapi.testclient import TestClient

from app.middleware.admin_auth import sign_admin_token

def get_client():
    from app.main import app
    return TestClient(app, raise_server_exceptions=False)

def make_admin_cookie(tabs=None):
    user = {
        "email": "admin@example.com",
        "name": "Admin User",
        "tabs": tabs or ["Invitations", "Dashboard", "Verify Members"],
        "owner": True,
    }
    token, csrf = sign_admin_token(user)
    return token, csrf

def test_invitations_stats():
    token, _ = make_admin_cookie()
    client = get_client()
    client.cookies.set("noctivus_admin_session", token)
    with patch("app.middleware.admin_auth.resolve_admin_access", new=AsyncMock(return_value={"tabs": ["Invitations"], "owner": True})):
        resp = client.get(
            "/api/admin/invitations/stats",
            headers={"Origin": "http://localhost:5173"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "totalRegistered" in data
    assert "totalEligible" in data
    assert "sentCount" in data
    assert "failedCount" in data
    assert "unsentCount" in data

def test_invitations_send_batch():
    token, csrf = make_admin_cookie()
    client = get_client()
    client.cookies.set("noctivus_admin_session", token)

    with patch("app.middleware.admin_auth.resolve_admin_access", new=AsyncMock(return_value={"tabs": ["Invitations"], "owner": True})), \
         patch("app.routes.admin_routes.send_member_pass", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {
            "success": True,
            "registrationId": "NOC26-TEST01",
            "name": "Test User",
            "email": "test@example.com",
        }

        resp = client.post(
            "/api/admin/invitations/send-batch",
            json={"batchSize": 5},
            headers={
                "X-CSRF-Token": csrf,
                "Origin": "http://localhost:5173",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "attempted" in data
        assert "succeeded" in data
        assert "failed" in data
        assert "successful" in data
        assert "failedList" in data

def test_invitations_resend_failed():
    token, csrf = make_admin_cookie()
    client = get_client()
    client.cookies.set("noctivus_admin_session", token)

    with patch("app.middleware.admin_auth.resolve_admin_access", new=AsyncMock(return_value={"tabs": ["Invitations"], "owner": True})), \
         patch("app.routes.admin_routes.send_member_pass", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {
            "success": True,
            "registrationId": "NOC26-TEST02",
            "name": "Test User 2",
            "email": "test2@example.com",
        }

        resp = client.post(
            "/api/admin/invitations/resend-failed",
            json={"registrationIds": ["NOC26-TEST02"]},
            headers={
                "X-CSRF-Token": csrf,
                "Origin": "http://localhost:5173",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "attempted" in data
        assert "succeeded" in data
