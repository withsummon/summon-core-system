# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import requests
from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.response import Response

from plane.summon.views.base import SummonAPIView
from plane.summon.access import require_capability
from plane.summon.serializers.settings import SummonWorkspaceSettingsSerializer
from plane.summon.views.commercial import WorkspaceContextMixin


class SummonWorkspaceSettingsView(WorkspaceContextMixin, SummonAPIView):
    summon_tool = {"PATCH": "none"}  # workspace settings stay with admins in the app
    permission_classes = [require_capability("workspace.view", "settings.edit")]

    @extend_schema(
        description="Summon settings for this workspace.", responses={200: SummonWorkspaceSettingsSerializer}
    )
    def get(self, request, slug):
        return Response(SummonWorkspaceSettingsSerializer(self.get_workspace()).data)

    @extend_schema(
        description="Change Summon settings for this workspace (workspace admins).",
        request=SummonWorkspaceSettingsSerializer,
        responses={200: SummonWorkspaceSettingsSerializer},
    )
    def patch(self, request, slug):
        serializer = SummonWorkspaceSettingsSerializer(
            self.get_workspace(),
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MCPStatusSerializer(serializers.Serializer):
    reachable = serializers.BooleanField()
    endpoint = serializers.CharField()
    transport = serializers.CharField()
    authentication = serializers.CharField()


class MCPStatusView(SummonAPIView):
    permission_classes = [require_capability("settings.view")]

    @extend_schema(
        summary="Plane MCP status",
        description="Whether the Plane MCP server is configured for this instance.",
        responses={200: MCPStatusSerializer},
    )
    def get(self, request, slug):
        try:
            requests.get(settings.SUMMON_MCP_URL, timeout=3)
            reachable = True
        except requests.RequestException:
            reachable = False
        return Response(
            {
                "reachable": reachable,
                "endpoint": "/mcp/http/api-key/mcp",
                "transport": "streamable-http",
                "authentication": "Plane personal access token",
            }
        )
