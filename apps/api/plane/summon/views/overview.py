# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import status
from rest_framework.response import Response

from plane.app.views.base import BaseAPIView
from plane.summon.permissions import SummonWorkspacePermission
from plane.summon.services.overview import home_summary, project_overview
from plane.summon.views.commercial import WorkspaceContextMixin


class HomeSummaryView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def get(self, request, slug):
        return Response(home_summary(self.get_workspace(), request.user))


class ProjectOverviewView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def get(self, request, slug, project_id):
        overview = project_overview(self.get_workspace(), request.user, project_id)
        if overview is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(overview)
