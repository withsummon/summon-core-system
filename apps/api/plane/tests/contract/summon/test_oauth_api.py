# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""OAuth for MCP clients: registration, consent, code exchange with PKCE, refresh rotation and revocation."""

import base64
import hashlib
from datetime import timedelta
from urllib.parse import parse_qs, urlsplit

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import APIToken, Workspace, WorkspaceMember
from plane.summon.models import OAuthCode, OAuthGrant

REDIRECT_URI = "http://127.0.0.1:53682/callback"
VERIFIER = "a-long-random-code-verifier-that-the-client-keeps-to-itself-0123456789"
CHALLENGE = base64.urlsafe_b64encode(hashlib.sha256(VERIFIER.encode()).digest()).rstrip(b"=").decode()


def register(client=None, **metadata):
    body = {"client_name": "Claude Code", "redirect_uris": [REDIRECT_URI], **metadata}
    return (client or APIClient()).post("/api/summon/oauth/register/", body, format="json")


def authorization(registered_id, **overrides):
    return {
        "client_id": registered_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "code_challenge": CHALLENGE,
        "code_challenge_method": "S256",
        "state": "xyz",
        **overrides,
    }


def start(registered_id, **overrides):
    """The client sends the browser to the authorization endpoint; it lands on the consent screen."""
    response = APIClient().get("/api/summon/oauth/authorize/", authorization(registered_id, **overrides))
    assert response.status_code == status.HTTP_302_FOUND
    location = response["Location"]
    assert location.startswith("/oauth/authorize/")
    return location.removeprefix("/oauth/authorize/")


def consent(session_client, request_id):
    return session_client.get(f"/api/summon/oauth/requests/{request_id}/")


def approve(session_client, client_id, workspace_slug, **overrides):
    return session_client.post(
        f"/api/summon/oauth/requests/{start(client_id, **overrides)}/",
        {"approve": True, "workspace_slug": workspace_slug},
        format="json",
    )


def token(**form):
    # Token requests are form-encoded (RFC 6749 §4.1.3).
    return APIClient().post("/api/summon/oauth/token/", form)


def code_from(response):
    query = parse_qs(urlsplit(response.json()["redirect_to"]).query)
    return query["code"][0]


@pytest.fixture(autouse=True)
def no_throttle_carryover():
    # The anonymous throttle counts in Redis, which outlives each test.
    cache.clear()


@pytest.fixture
def client_id(db):
    return register().json()["client_id"]


@pytest.fixture
def tokens(session_client, workspace, client_id):
    code = code_from(approve(session_client, client_id, workspace.slug))
    response = token(
        grant_type="authorization_code",
        client_id=client_id,
        code=code,
        redirect_uri=REDIRECT_URI,
        code_verifier=VERIFIER,
    )
    assert response.status_code == status.HTTP_200_OK, response.content
    return response.json()


@pytest.mark.django_db
def test_metadata_points_clients_at_the_endpoints(settings):
    settings.WEB_URL = "https://core.example.com/"
    response = APIClient().get("/.well-known/oauth-authorization-server")
    assert response.status_code == status.HTTP_200_OK
    metadata = response.json()
    assert metadata["issuer"] == "https://core.example.com"
    assert metadata["authorization_endpoint"] == "https://core.example.com/api/summon/oauth/authorize/"
    assert metadata["token_endpoint"] == "https://core.example.com/api/summon/oauth/token/"
    assert metadata["registration_endpoint"] == "https://core.example.com/api/summon/oauth/register/"
    assert metadata["code_challenge_methods_supported"] == ["S256"]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "redirect_uri",
    ["https://claude.ai/api/mcp/auth_callback", "http://localhost:3118/callback", "cursor://anysphere.cursor/oauth"],
)
def test_register_accepts_https_loopback_and_app_redirects(redirect_uri):
    response = register(redirect_uris=[redirect_uri])
    assert response.status_code == status.HTTP_201_CREATED, response.content
    body = response.json()
    assert body["redirect_uris"] == [redirect_uri]
    assert body["token_endpoint_auth_method"] == "none"
    assert "client_secret" not in body


@pytest.mark.django_db
@pytest.mark.parametrize(
    "redirect_uris",
    [[], ["http://evil.example.com/callback"], ["javascript:alert(1)"], ["https://app.example.com/cb#frag"], "x"],
)
def test_register_refuses_unsafe_redirects(redirect_uris):
    response = register(redirect_uris=redirect_uris)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"] == "invalid_redirect_uri"


@pytest.mark.django_db
def test_register_refuses_confidential_clients():
    response = register(token_endpoint_auth_method="client_secret_basic")
    assert response.json()["error"] == "invalid_client_metadata"


@pytest.mark.django_db
def test_consent_needs_a_session(client_id):
    response = APIClient().get(f"/api/summon/oauth/requests/{start(client_id)}/")
    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
def test_consent_describes_the_client_and_lists_my_workspaces(session_client, workspace, create_user, client_id):
    other = Workspace.objects.create(name="Not mine", owner=create_user, slug="not-mine")
    WorkspaceMember.objects.create(workspace=other, member=create_user, role=20, is_active=False)
    response = consent(session_client, start(client_id))
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "client_name": "Claude Code",
        "redirect_uri": REDIRECT_URI,
        "workspaces": [{"slug": workspace.slug, "name": workspace.name}],
    }


@pytest.mark.django_db
@pytest.mark.parametrize(
    "overrides,error",
    [
        ({"client_id": "00000000-0000-0000-0000-000000000000"}, "invalid_request"),
        ({"client_id": "not-a-uuid"}, "invalid_request"),
        ({"redirect_uri": "https://evil.example.com/callback"}, "invalid_request"),
        ({"response_type": "token"}, "unsupported_response_type"),
        ({"code_challenge_method": "plain"}, "invalid_request"),
        ({"code_challenge": ""}, "invalid_request"),
    ],
)
def test_consent_refuses_bad_requests_without_redirecting(session_client, workspace, client_id, overrides, error):
    response = consent(session_client, start(client_id, **overrides))
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"] == error


@pytest.mark.django_db
def test_loopback_redirect_may_use_another_port(session_client, workspace, client_id):
    response = approve(session_client, client_id, workspace.slug, redirect_uri="http://127.0.0.1:61000/callback")
    assert response.json()["redirect_to"].startswith("http://127.0.0.1:61000/callback?code=")


@pytest.mark.django_db
def test_approve_refuses_a_workspace_i_am_not_in(session_client, workspace, create_user, client_id):
    Workspace.objects.create(name="Elsewhere", owner=create_user, slug="elsewhere")
    response = approve(session_client, client_id, "elsewhere")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert not OAuthCode.objects.exists()


@pytest.mark.django_db
def test_deny_sends_access_denied_back_to_the_client(session_client, workspace, client_id):
    request_id = start(client_id)
    response = session_client.post(f"/api/summon/oauth/requests/{request_id}/", {"approve": False}, format="json")
    assert response.json() == {"redirect_to": f"{REDIRECT_URI}?error=access_denied&state=xyz"}
    # Answered requests are gone: the screen can't be replayed.
    assert consent(session_client, request_id).status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_an_unknown_request_has_expired(session_client):
    response = consent(session_client, "made-up")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["error"] == "invalid_request"


@pytest.mark.django_db
def test_code_exchange_issues_a_workspace_api_token(tokens, workspace, create_user):
    assert tokens["token_type"] == "Bearer"
    assert tokens["expires_in"] == 3600
    api_token = APIToken.objects.get(token=tokens["access_token"])
    assert api_token.user == create_user
    assert api_token.workspace == workspace
    assert api_token.label == "MCP · Claude Code"
    assert api_token.expired_at > timezone.now()
    # The token works on Summon's API like any API key, and names its workspace for the AI service.
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=tokens["access_token"])
    assert client.get(f"/api/summon/workspaces/{workspace.slug}/access/me/").status_code == status.HTTP_200_OK
    assert client.get("/api/summon/api-key/workspace/").json() == {"workspace_slug": workspace.slug}


@pytest.mark.django_db
def test_a_code_works_once(session_client, workspace, client_id):
    code = code_from(approve(session_client, client_id, workspace.slug))
    form = dict(
        grant_type="authorization_code",
        client_id=client_id,
        code=code,
        redirect_uri=REDIRECT_URI,
        code_verifier=VERIFIER,
    )
    assert token(**form).status_code == status.HTTP_200_OK
    again = token(**form)
    assert again.status_code == status.HTTP_400_BAD_REQUEST
    assert again.json()["error"] == "invalid_grant"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "overrides",
    [{"code_verifier": "wrong"}, {"redirect_uri": "http://127.0.0.1:1/other"}],
)
def test_code_exchange_checks_pkce_and_redirect(session_client, workspace, client_id, overrides):
    code = code_from(approve(session_client, client_id, workspace.slug))
    form = dict(
        grant_type="authorization_code",
        client_id=client_id,
        code=code,
        redirect_uri=REDIRECT_URI,
        code_verifier=VERIFIER,
    )
    response = token(**{**form, **overrides})
    assert response.json()["error"] == "invalid_grant"
    assert not APIToken.objects.exists()
    # A failed attempt spends the code.
    assert not OAuthCode.objects.exists()


@pytest.mark.django_db
def test_an_unknown_code_is_refused(client_id):
    response = token(
        grant_type="authorization_code",
        client_id=client_id,
        code="made-up",
        redirect_uri=REDIRECT_URI,
        code_verifier=VERIFIER,
    )
    assert response.json()["error"] == "invalid_grant"


@pytest.mark.django_db
def test_an_expired_code_is_refused(session_client, workspace, client_id):
    code = code_from(approve(session_client, client_id, workspace.slug))
    OAuthCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    response = token(
        grant_type="authorization_code",
        client_id=client_id,
        code=code,
        redirect_uri=REDIRECT_URI,
        code_verifier=VERIFIER,
    )
    assert response.json()["error"] == "invalid_grant"


@pytest.mark.django_db
def test_another_client_cannot_use_the_code(session_client, workspace, client_id):
    code = code_from(approve(session_client, client_id, workspace.slug))
    other = register().json()["client_id"]
    response = token(
        grant_type="authorization_code",
        client_id=other,
        code=code,
        redirect_uri=REDIRECT_URI,
        code_verifier=VERIFIER,
    )
    assert response.json()["error"] == "invalid_grant"


@pytest.mark.django_db
def test_refresh_rotates_both_tokens(tokens, client_id):
    grant = OAuthGrant.objects.get()
    response = token(grant_type="refresh_token", client_id=client_id, refresh_token=tokens["refresh_token"])
    assert response.status_code == status.HTTP_200_OK
    refreshed = response.json()
    assert refreshed["access_token"] != tokens["access_token"]
    assert refreshed["refresh_token"] != tokens["refresh_token"]
    # Same API token row, new value: the old access token stops working.
    assert APIToken.objects.get(token=refreshed["access_token"]).id == grant.api_token_id
    assert not APIToken.objects.filter(token=tokens["access_token"]).exists()
    reused = token(grant_type="refresh_token", client_id=client_id, refresh_token=tokens["refresh_token"])
    assert reused.json()["error"] == "invalid_grant"


@pytest.mark.django_db
def test_deleting_the_api_token_signs_the_client_out(tokens, client_id):
    # Plane's API token settings soft-delete the token.
    APIToken.objects.get(token=tokens["access_token"]).delete()
    response = token(grant_type="refresh_token", client_id=client_id, refresh_token=tokens["refresh_token"])
    assert response.json()["error"] == "invalid_grant"


@pytest.mark.django_db
def test_leaving_the_workspace_stops_refresh(tokens, client_id, workspace, create_user):
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(is_active=False)
    response = token(grant_type="refresh_token", client_id=client_id, refresh_token=tokens["refresh_token"])
    assert response.json()["error"] == "invalid_grant"


@pytest.mark.django_db
def test_unknown_grant_type_is_refused(client_id):
    assert token(grant_type="password", client_id=client_id).json()["error"] == "unsupported_grant_type"


@pytest.mark.django_db
def test_an_api_key_without_a_workspace_has_none_to_report(api_key_client):
    response = api_key_client.get("/api/summon/api-key/workspace/")
    assert response.status_code == status.HTTP_404_NOT_FOUND
