# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""OAuth endpoints for MCP clients (see `plane.summon.services.oauth`). None of them are MCP tools.

The browser half is the web app's consent screen at `/oauth/authorize/<request>`: it signs the person in, then
calls `OAuthRequestView` to show the client and send the browser back to it.
"""

from django.conf import settings
from django.http import HttpResponseRedirect
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from plane.db.models import APIToken, WorkspaceMember
from plane.summon.authentication import SummonAPIKeyAuthentication
from plane.summon.services import oauth
from plane.summon.views.base import SESSION_ONLY_AUTHENTICATION, SummonAPIView


def _error(error):
    return Response(error.body(), status=error.status, headers={"Cache-Control": "no-store"})


class OAuthServerMetadataView(SummonAPIView):
    """`/.well-known/oauth-authorization-server`: where MCP clients find the endpoints below."""

    summon_tool = "none"
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(exclude=True)
    def get(self, request):
        return Response(oauth.server_metadata(settings.WEB_URL.rstrip("/")))


class OAuthRegisterView(SummonAPIView):
    summon_tool = "none"
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(exclude=True)
    def post(self, request):
        try:
            client = oauth.register_client(request.data)
        except oauth.OAuthError as error:
            return _error(error)
        return Response(
            {
                "client_id": str(client.id),
                "client_id_issued_at": int(client.created_at.timestamp()),
                "client_name": client.name,
                "redirect_uris": client.redirect_uris,
                "grant_types": oauth.GRANT_TYPES,
                "response_types": ["code"],
                "token_endpoint_auth_method": "none",
            },
            status=status.HTTP_201_CREATED,
        )


class OAuthTokenView(SummonAPIView):
    summon_tool = "none"
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(exclude=True)
    def post(self, request):
        grant_type = request.data.get("grant_type")
        try:
            if grant_type == "authorization_code":
                tokens = oauth.exchange_code(request.data)
            elif grant_type == "refresh_token":
                tokens = oauth.refresh(request.data)
            else:
                raise oauth.OAuthError("unsupported_grant_type", "Use authorization_code or refresh_token.")
        except oauth.OAuthError as error:
            return _error(error)
        return Response(tokens, headers={"Cache-Control": "no-store", "Pragma": "no-cache"})


class OAuthAuthorizeView(SummonAPIView):
    """The authorization endpoint: keeps the client's request and sends the browser to the consent screen."""

    summon_tool = "none"
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(exclude=True)
    def get(self, request):
        return HttpResponseRedirect(f"/oauth/authorize/{oauth.stash_request(request.query_params)}")


class OAuthRequestView(SummonAPIView):
    """The consent screen's API. GET describes the request; POST answers it with the person's choice."""

    summon_tool = "none"
    authentication_classes = SESSION_ONLY_AUTHENTICATION
    permission_classes = [IsAuthenticated]

    @extend_schema(exclude=True)
    def get(self, request, request_id):
        try:
            client, redirect_uri = oauth.authorization_request(oauth.stashed_request(request_id))
        except oauth.OAuthError as error:
            return _error(error)
        workspaces = (
            WorkspaceMember.objects.filter(member=request.user, is_active=True, workspace__deleted_at__isnull=True)
            .order_by("workspace__name")
            .values("workspace__slug", "workspace__name")
        )
        return Response(
            {
                "client_name": client.name,
                "redirect_uri": redirect_uri,
                "workspaces": [{"slug": row["workspace__slug"], "name": row["workspace__name"]} for row in workspaces],
            }
        )

    @extend_schema(exclude=True)
    def post(self, request, request_id):
        try:
            params = oauth.stashed_request(request_id)
            if request.data.get("approve") is True:
                redirect_to = oauth.approve(request.user, params, request.data.get("workspace_slug") or "")
            else:
                redirect_to = oauth.deny(params)
        except oauth.OAuthError as error:
            return _error(error)
        oauth.forget_request(request_id)
        return Response({"redirect_to": redirect_to})


class APIKeyWorkspaceView(SummonAPIView):
    """The workspace an API key belongs to. MCP clients that signed in with OAuth send only the token."""

    summon_tool = "none"
    authentication_classes = [SummonAPIKeyAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(exclude=True)
    def get(self, request):
        slug = (
            APIToken.objects.filter(token=request.auth, workspace__isnull=False)
            .values_list("workspace__slug", flat=True)
            .first()
        )
        if slug is None:
            return Response({"error_code": "api_key_has_no_workspace"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"workspace_slug": slug})
