# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import requests
from django.conf import settings
from rest_framework.response import Response

from plane.app.views.base import BaseAPIView
from plane.summon.access import require_capability
from plane.summon.serializers.settings import SummonWorkspaceSettingsSerializer
from plane.summon.views.commercial import WorkspaceContextMixin


class SummonWorkspaceSettingsView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [require_capability("workspace.view", "settings.edit")]

    def get(self, request, slug):
        return Response(SummonWorkspaceSettingsSerializer(self.get_workspace()).data)

    def patch(self, request, slug):
        serializer = SummonWorkspaceSettingsSerializer(
            self.get_workspace(),
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MCPStatusView(BaseAPIView):
    permission_classes = [require_capability("settings.view")]

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
