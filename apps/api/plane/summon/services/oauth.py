# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The OAuth 2.1 authorization server MCP clients sign in with (authorization code + PKCE, RFC 7591 registration).

The access token is a Plane API token for the workspace the person picks on the consent screen, so every
downstream check (Summon's API-key authentication, the Plane MCP server) applies unchanged. A refresh replaces
that token's value and expiry; the refresh token itself rotates on every use.
"""

import base64
import hashlib
import secrets
import uuid
from datetime import timedelta
from hmac import compare_digest
from urllib.parse import urlencode, urlsplit

from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from plane.db.models import APIToken
from plane.db.models.api import generate_token
from plane.summon.access import active_membership
from plane.summon.models import OAuthClient, OAuthCode, OAuthGrant

SCOPE = "mcp"
GRANT_TYPES = ["authorization_code", "refresh_token"]
CODE_TTL = timedelta(minutes=10)
ACCESS_TTL = timedelta(hours=1)
REFRESH_TTL = timedelta(days=30)

REQUEST_PARAMS = (
    "client_id",
    "redirect_uri",
    "response_type",
    "code_challenge",
    "code_challenge_method",
    "state",
    "scope",
    "resource",
)
REQUEST_CACHE_PREFIX = "summon:oauth:request:"
MAX_PARAM_LENGTH = 2048

LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}
# Schemes a browser would run or read instead of handing to an app.
UNSAFE_SCHEMES = {"javascript", "data", "file", "vbscript", "about", "blob"}
MAX_REDIRECT_URIS = 10


class OAuthError(Exception):
    """An OAuth error response (RFC 6749 §5.2): `code` is the `error` value."""

    def __init__(self, code, description, status=400):
        super().__init__(description)
        self.code = code
        self.description = description
        self.status = status

    def body(self):
        return {"error": self.code, "error_description": self.description}


def register_client(data):
    """Registers a public client (RFC 7591) and returns it."""
    redirect_uris = data.get("redirect_uris")
    if not isinstance(redirect_uris, list) or not redirect_uris or len(redirect_uris) > MAX_REDIRECT_URIS:
        raise OAuthError("invalid_redirect_uri", f"Send 1 to {MAX_REDIRECT_URIS} redirect_uris.")
    for uri in redirect_uris:
        if not isinstance(uri, str) or not _redirect_uri_allowed(uri):
            raise OAuthError(
                "invalid_redirect_uri", "Redirect URIs must be https, a loopback http URL or an app scheme."
            )
    if data.get("token_endpoint_auth_method", "none") != "none":
        raise OAuthError(
            "invalid_client_metadata", "Only public clients are supported: token_endpoint_auth_method none."
        )
    if not set(data.get("grant_types") or ["authorization_code"]) <= set(GRANT_TYPES):
        raise OAuthError("invalid_client_metadata", "Supported grant types: authorization_code, refresh_token.")
    name = str(data.get("client_name") or "MCP client").strip()[:255] or "MCP client"
    return OAuthClient.objects.create(name=name, redirect_uris=redirect_uris)


def stash_request(params):
    """Keeps a client's authorization request while the person signs in, and returns its ID.

    The consent screen then needs only that short ID in its path, which survives the sign-in redirect;
    the request's own query string would not.
    """
    request_id = secrets.token_urlsafe(16)
    stored = {name: str(params[name])[:MAX_PARAM_LENGTH] for name in REQUEST_PARAMS if params.get(name)}
    cache.set(f"{REQUEST_CACHE_PREFIX}{request_id}", stored, int(CODE_TTL.total_seconds()))
    return request_id


def stashed_request(request_id):
    params = cache.get(f"{REQUEST_CACHE_PREFIX}{request_id}")
    if params is None:
        raise OAuthError("invalid_request", "This sign-in link expired. Connect again from your MCP client.", 404)
    return params


def forget_request(request_id):
    cache.delete(f"{REQUEST_CACHE_PREFIX}{request_id}")


def authorization_request(params):
    """Checks an authorization request and returns its client and redirect URI.

    Every failure is shown on the consent screen rather than sent to the redirect URI: until the client and
    its redirect URI check out, nothing may be sent there.
    """
    client = _client(params.get("client_id"))
    redirect_uri = params.get("redirect_uri") or ""
    if not any(_redirect_uri_matches(registered, redirect_uri) for registered in client.redirect_uris):
        raise OAuthError("invalid_request", "This redirect_uri is not registered for the client.")
    if params.get("response_type") != "code":
        raise OAuthError("unsupported_response_type", "Only response_type=code is supported.")
    if params.get("code_challenge_method") != "S256" or not params.get("code_challenge"):
        raise OAuthError("invalid_request", "PKCE is required: send code_challenge with code_challenge_method=S256.")
    return client, redirect_uri


def approve(user, params, workspace_slug):
    """Issues an authorization code for `user` in their workspace and returns where to send the browser."""
    client, redirect_uri = authorization_request(params)
    membership = active_membership(user, workspace_slug)
    if membership is None:
        raise OAuthError("invalid_request", "You are not a member of that workspace.")
    code = secrets.token_urlsafe(32)
    OAuthCode.objects.create(
        code_hash=_hash(code),
        client=client,
        user=user,
        workspace=membership.workspace,
        redirect_uri=redirect_uri,
        code_challenge=params["code_challenge"],
        expires_at=timezone.now() + CODE_TTL,
    )
    return _with_query(redirect_uri, code=code, state=params.get("state"))


def deny(params):
    """Where to send the browser when the person declines."""
    _, redirect_uri = authorization_request(params)
    return _with_query(redirect_uri, error="access_denied", state=params.get("state"))


def exchange_code(data):
    """`grant_type=authorization_code`: trades a code and its PKCE verifier for tokens."""
    client = _client(data.get("client_id"), error="invalid_client", status=401)
    with transaction.atomic():
        code = (
            OAuthCode.objects.select_for_update()
            .select_related("user", "workspace")
            .filter(code_hash=_hash(data.get("code") or ""), client=client)
            .first()
        )
        if code is None:
            raise OAuthError("invalid_grant", "The authorization code is invalid or was already used.")
        # Single use: spent whether or not the rest of the request checks out.
        code.delete()
    if code.expires_at <= timezone.now():
        raise OAuthError("invalid_grant", "The authorization code expired.")
    if data.get("redirect_uri") != code.redirect_uri:
        raise OAuthError("invalid_grant", "redirect_uri does not match the authorization request.")
    if not compare_digest(_pkce_challenge(data.get("code_verifier") or ""), code.code_challenge):
        raise OAuthError("invalid_grant", "code_verifier does not match the code_challenge.")
    if not code.user.is_active or active_membership(code.user, code.workspace.slug) is None:
        raise OAuthError("invalid_grant", "This account can no longer use that workspace.")

    api_token = APIToken(
        user=code.user,
        workspace=code.workspace,
        label=f"MCP · {client.name}"[:255],
        description="Signed in from an MCP client. Delete this token to sign that client out.",
        expired_at=timezone.now() + ACCESS_TTL,
    )
    api_token.save(created_by_id=code.user.id)
    refresh_token = secrets.token_urlsafe(32)
    OAuthGrant.objects.create(
        client=client,
        api_token=api_token,
        refresh_token_hash=_hash(refresh_token),
        refresh_expires_at=timezone.now() + REFRESH_TTL,
    )
    return _token_response(api_token, refresh_token)


def refresh(data):
    """`grant_type=refresh_token`: a new access token and a new refresh token; the old ones stop working."""
    client = _client(data.get("client_id"), error="invalid_client", status=401)
    with transaction.atomic():
        grant = (
            # Locks only the grant: the token's workspace is a nullable join, which Postgres can't lock.
            OAuthGrant.objects.select_for_update(of=("self",))
            .select_related("api_token__user", "api_token__workspace")
            .filter(refresh_token_hash=_hash(data.get("refresh_token") or ""), client=client)
            .first()
        )
        if grant is None or grant.refresh_expires_at <= timezone.now():
            raise OAuthError("invalid_grant", "The refresh token is invalid or expired.")
        api_token = grant.api_token
        # Deleting the API token in Plane soft-deletes it; that signs the client out too.
        if (
            api_token.deleted_at is not None
            or not api_token.is_active
            or not api_token.user.is_active
            or active_membership(api_token.user, api_token.workspace.slug) is None
        ):
            raise OAuthError("invalid_grant", "This sign-in was revoked.")
        api_token.token = generate_token()
        api_token.expired_at = timezone.now() + ACCESS_TTL
        api_token.save(disable_auto_set_user=True, update_fields=["token", "expired_at", "updated_at"])
        refresh_token = secrets.token_urlsafe(32)
        grant.refresh_token_hash = _hash(refresh_token)
        grant.refresh_expires_at = timezone.now() + REFRESH_TTL
        grant.save(update_fields=["refresh_token_hash", "refresh_expires_at", "updated_at"])
    return _token_response(api_token, refresh_token)


def server_metadata(issuer):
    """Authorization server metadata (RFC 8414) for an issuer such as `https://core.withsummon.com`."""
    return {
        "issuer": issuer,
        "authorization_endpoint": f"{issuer}/api/summon/oauth/authorize/",
        "token_endpoint": f"{issuer}/api/summon/oauth/token/",
        "registration_endpoint": f"{issuer}/api/summon/oauth/register/",
        "scopes_supported": [SCOPE],
        "response_types_supported": ["code"],
        "grant_types_supported": GRANT_TYPES,
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
    }


def _client(client_id, error="invalid_request", status=400):
    try:
        client = OAuthClient.objects.filter(id=uuid.UUID(str(client_id))).first()
    except ValueError:
        client = None
    if client is None:
        raise OAuthError(error, "Unknown client_id. Register the client again.", status)
    return client


def _token_response(api_token, refresh_token):
    return {
        "access_token": api_token.token,
        "token_type": "Bearer",
        "expires_in": int(ACCESS_TTL.total_seconds()),
        "refresh_token": refresh_token,
        "scope": SCOPE,
    }


def _redirect_uri_allowed(uri):
    parts = urlsplit(uri)
    if parts.fragment or not parts.scheme:
        return False
    if parts.scheme == "https":
        return bool(parts.hostname)
    if parts.scheme == "http":
        return parts.hostname in LOOPBACK_HOSTS
    return parts.scheme not in UNSAFE_SCHEMES


def _redirect_uri_matches(registered, requested):
    """Exact match, except that a loopback redirect may use any port (RFC 8252 §7.3): native apps pick one per run."""
    if registered == requested:
        return True
    a, b = urlsplit(registered), urlsplit(requested)
    return (
        a.scheme == b.scheme == "http"
        and a.hostname in LOOPBACK_HOSTS
        and a.hostname == b.hostname
        and (a.path, a.query) == (b.path, b.query)
    )


def _with_query(uri, **params):
    query = urlencode({name: value for name, value in params.items() if value is not None})
    return f"{uri}{'&' if urlsplit(uri).query else '?'}{query}"


def _pkce_challenge(verifier):
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


def _hash(secret):
    return hashlib.sha256(secret.encode()).hexdigest()
