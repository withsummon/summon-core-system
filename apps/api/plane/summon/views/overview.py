# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import status
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.response import Response

from plane.summon.views.base import SummonAPIView
from plane.summon.permissions import SummonWorkspacePermission
from plane.summon.services.overview import home_summary, project_overview
from plane.summon.views.commercial import WorkspaceContextMixin


class HomeSummaryView(WorkspaceContextMixin, SummonAPIView):
    permission_classes = [SummonWorkspacePermission]

    @extend_schema(
        description=(
            "Your workspace home: the projects you can see with their health, work due soon, and recent meetings."
        ),
        responses={
            200: OpenApiResponse(
                OpenApiTypes.OBJECT, description="Home dashboard: visible projects, health, due work, recent meetings."
            )
        },
    )
    def get(self, request, slug):
        return Response(home_summary(self.get_workspace(), request.user))


class ProjectOverviewView(WorkspaceContextMixin, SummonAPIView):
    permission_classes = [SummonWorkspacePermission]

    @extend_schema(
        description="Delivery overview of one project you can see: progress, health, due work and recent meetings.",
        responses={
            200: OpenApiResponse(OpenApiTypes.OBJECT, description="One project's delivery overview."),
            404: None,
        },
    )
    def get(self, request, slug, project_id):
        overview = project_overview(self.get_workspace(), request.user, project_id)
        if overview is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(overview)
