# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Prefetch, Q
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView, BaseViewSet
from plane.license.utils.instance_value import get_llm_configuration_status
from plane.summon.models import (
    AssistantConversation,
    AssistantMessage,
    AutomationJob,
    AutomationTemplate,
    GeneratedArtifact,
)
from plane.summon.permissions import SummonWorkspacePermission
from plane.summon.serializers.operations import (
    AssistantConversationSerializer,
    AssistantMessageRequestSerializer,
    AssistantMessageSerializer,
    AssistantQuerySerializer,
    AutomationJobSerializer,
    AutomationRunSerializer,
    AutomationTemplateSerializer,
    ReportFilterSerializer,
)
from plane.summon.services.assistant import answer_query, send_message
from plane.summon.services.automation import (
    authorize_artifact_download,
    ensure_default_templates,
    generate_preview,
    publish_job,
    render_job_files,
)
from plane.summon.services.reports import report_csv, report_summary, visible_project_ids
from plane.summon.views.commercial import WorkspaceContextMixin


class AutomationTemplateViewSet(WorkspaceContextMixin, BaseViewSet):
    model = AutomationTemplate
    serializer_class = AutomationTemplateSerializer
    permission_classes = [SummonWorkspacePermission]

    def get_queryset(self):
        ensure_default_templates(self.get_workspace())
        return AutomationTemplate.objects.filter(workspace=self.get_workspace(), is_active=True)

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
        if not request.data.get("project"):
            return Response(
                {
                    "error_code": "project_required",
                    "project": "Select an authorized Plane Project before generating a preview.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = AutomationRunSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        job = generate_preview(
            serializer.validated_data["template"],
            serializer.validated_data.get("project"),
            request.user,
            serializer.validated_data["input"],
            serializer.validated_data["context"],
        )
        job = AutomationJob.objects.prefetch_related("artifacts__page", "artifacts__file_asset").get(pk=job.pk)
        data = dict(AutomationJobSerializer(job).data)
        if job.status == AutomationJob.Status.FAILED:
            data["error_code"] = job.error_summary
            return Response(data, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(data, status=status.HTTP_201_CREATED)


class AutomationPublishView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def post(self, request, slug, job_id):
        job = get_object_or_404(
            AutomationJob,
            id=job_id,
            workspace=self.get_workspace(),
            requested_by=request.user,
        )
        publish_job(job, request.user)
        job = AutomationJob.objects.prefetch_related("artifacts__page", "artifacts__file_asset").get(pk=job.pk)
        return Response(AutomationJobSerializer(job).data)


class AutomationRenderView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def post(self, request, slug, job_id):
        job = get_object_or_404(
            AutomationJob,
            id=job_id,
            workspace=self.get_workspace(),
            requested_by=request.user,
        )
        render_job_files(job, request.user)
        job = AutomationJob.objects.prefetch_related("artifacts__page", "artifacts__file_asset").get(pk=job.pk)
        return Response(AutomationJobSerializer(job).data)


class GeneratedArtifactDownloadView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def get(self, request, slug, artifact_id):
        artifact = get_object_or_404(
            GeneratedArtifact,
            id=artifact_id,
            workspace=self.get_workspace(),
        )
        artifact = authorize_artifact_download(artifact, request.user)
        attributes = artifact.file_asset.attributes
        return FileResponse(
            artifact.file_asset.asset.open("rb"),
            as_attachment=True,
            filename=attributes.get("name", "document"),
            content_type=attributes.get("type", "application/octet-stream"),
        )


class ReportSummaryView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def get(self, request, slug):
        serializer = ReportFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        return Response(report_summary(self.get_workspace(), request.user, serializer.validated_data))


class ReportExportView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def get(self, request, slug):
        serializer = ReportFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        workspace = self.get_workspace()
        response = HttpResponse(
            report_csv(workspace, request.user, serializer.validated_data),
            content_type="text/csv; charset=utf-8",
        )
        response["Content-Disposition"] = f'attachment; filename="summon-report-{workspace.slug}.csv"'
        return response


class LLMStatusView(BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def get(self, request, slug):
        return Response(get_llm_configuration_status())


class AssistantQueryView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def post(self, request, slug):
        serializer = AssistantQuerySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(answer_query(self.get_workspace(), request.user, **serializer.validated_data))


class AssistantConversationViewSet(WorkspaceContextMixin, BaseViewSet):
    model = AssistantConversation
    serializer_class = AssistantConversationSerializer
    permission_classes = [SummonWorkspacePermission]

    def get_queryset(self):
        return (
            AssistantConversation.objects.filter(
                workspace=self.get_workspace(),
                owner=self.request.user,
            )
            .select_related("project", "client")
            .prefetch_related(Prefetch("messages", queryset=AssistantMessage.objects.order_by("created_at")))
        )

    def perform_create(self, serializer):
        serializer.save(workspace=self.get_workspace(), owner=self.request.user)


class AssistantMessageView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def get_conversation(self):
        return get_object_or_404(
            AssistantConversation,
            id=self.kwargs["conversation_id"],
            workspace=self.get_workspace(),
            owner=self.request.user,
        )

    def get(self, request, slug, conversation_id):
        messages = AssistantMessage.objects.filter(conversation=self.get_conversation()).order_by("created_at")
        return Response(AssistantMessageSerializer(messages, many=True).data)

    def post(self, request, slug, conversation_id):
        serializer = AssistantMessageRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_message, assistant_message, truncated, error_code = send_message(
            self.get_conversation(),
            request.user,
            serializer.validated_data["content"],
            serializer.validated_data["context"],
            serializer.validated_data["intent"],
        )
        data = {
            "user_message": AssistantMessageSerializer(user_message).data,
            "assistant_message": AssistantMessageSerializer(assistant_message).data,
            "context_truncated": truncated,
        }
        if error_code:
            data["error_code"] = error_code
            return Response(data, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(data, status=status.HTTP_201_CREATED)
