# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response

from plane.app.views.base import BaseAPIView, BaseViewSet
from plane.summon.models import AutomationJob, AutomationTemplate
from plane.summon.permissions import SummonWorkspacePermission
from plane.summon.serializers.operations import (
    AssistantQuerySerializer,
    AutomationJobSerializer,
    AutomationRunSerializer,
    AutomationTemplateSerializer,
)
from plane.summon.services.assistant import answer_query
from plane.summon.services.automation import ensure_default_templates, run_automation
from plane.summon.services.reports import report_summary, visible_project_ids
from plane.summon.views.commercial import WorkspaceContextMixin


class AutomationTemplateViewSet(WorkspaceContextMixin, BaseViewSet):
    model = AutomationTemplate
    serializer_class = AutomationTemplateSerializer
    permission_classes = [SummonWorkspacePermission]

    def get_queryset(self):
        ensure_default_templates(self.get_workspace())
        return AutomationTemplate.objects.filter(workspace=self.get_workspace())

    def perform_create(self, serializer):
        serializer.save(workspace=self.get_workspace())


class AutomationJobView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def get(self, request, slug):
        project_ids = visible_project_ids(self.get_workspace(), request.user)
        jobs = (
            AutomationJob.objects.filter(workspace=self.get_workspace())
            .filter(Q(project__isnull=True) | Q(project_id__in=project_ids))
            .select_related("template", "project")
            .prefetch_related("artifacts__page", "artifacts__file_asset")
        )
        return Response(AutomationJobSerializer(jobs, many=True).data)

    def post(self, request, slug):
        serializer = AutomationRunSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        job = run_automation(
            serializer.validated_data["template"],
            serializer.validated_data.get("project"),
            request.user,
            serializer.validated_data["input"],
        )
        job = AutomationJob.objects.prefetch_related("artifacts__page", "artifacts__file_asset").get(pk=job.pk)
        return Response(AutomationJobSerializer(job).data, status=status.HTTP_201_CREATED)


class ReportSummaryView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def get(self, request, slug):
        return Response(report_summary(self.get_workspace(), request.user))


class AssistantQueryView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def post(self, request, slug):
        serializer = AssistantQuerySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(answer_query(self.get_workspace(), request.user, **serializer.validated_data))
