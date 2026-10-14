# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Q
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework import status
from rest_framework.response import Response

from plane.summon.views.base import SummonAPIView, SummonViewSet
from plane.license.utils.instance_value import get_llm_configuration_status
from plane.summon.models import (
    AutomationJob,
    AutomationTemplate,
    GeneratedArtifact,
)
from plane.summon.access import require_capability
from plane.summon.permissions import SummonWorkspacePermission
from plane.summon.serializers.operations import (
    AssistantQuerySerializer,
    AutomationJobSerializer,
    AutomationRunSerializer,
    AutomationTemplateSerializer,
    ReportFilterSerializer,
)
from plane.summon.serializers.shapes import ErrorCodeSerializer
from plane.summon.services.assistant import answer_query
from plane.summon.services.automation import (
    authorize_artifact_download,
    generate_preview,
    publish_job,
    render_job_files,
)
from plane.summon.services.automation_templates import refresh_default_templates
from plane.summon.services.context_document import extract_context_document
from plane.summon.services.reports import report_csv, report_summary, visible_project_ids
from plane.summon.views.commercial import WorkspaceContextMixin


class AutomationJobFailureSerializer(AutomationJobSerializer):
    """Schema only: the failed job, plus its error code."""

    error_code = serializers.CharField()

    class Meta(AutomationJobSerializer.Meta):
        fields = [*AutomationJobSerializer.Meta.fields, "error_code"]


class ContextDocumentSerializer(serializers.Serializer):
    name = serializers.CharField()
    text = serializers.CharField(allow_blank=True)
    truncated = serializers.BooleanField()


class LLMStatusSerializer(serializers.Serializer):
    configured = serializers.BooleanField()
    provider = serializers.CharField(allow_null=True)
    model = serializers.CharField(allow_null=True)


class AssistantQueryResultSerializer(serializers.Serializer):
    intent = serializers.CharField()
    answer = serializers.CharField()
    data = serializers.JSONField(help_text="Rows or a record, depending on the intent.")


class AutomationTemplateViewSet(WorkspaceContextMixin, SummonViewSet):
    model = AutomationTemplate
    serializer_class = AutomationTemplateSerializer
    permission_classes = [SummonWorkspacePermission]

    def get_queryset(self):
        refresh_default_templates(self.get_workspace())
        return AutomationTemplate.objects.filter(workspace=self.get_workspace(), is_active=True)

    def perform_create(self, serializer):
        serializer.save(workspace=self.get_workspace())


class AutomationJobView(WorkspaceContextMixin, SummonAPIView):
    permission_classes = [SummonWorkspacePermission]

    @extend_schema(
        description="List document automation jobs you can see.", responses={200: AutomationJobSerializer(many=True)}
    )
    def get(self, request, slug):
        jobs = visible_automation_jobs(self.get_workspace(), request.user)
        return Response(AutomationJobSerializer(jobs, many=True).data)

    @extend_schema(
        description="Generate a document preview from an automation template for a project. Slow: runs the AI model.",
        request=AutomationRunSerializer,
        responses={201: AutomationJobSerializer, 400: ErrorCodeSerializer, 503: AutomationJobFailureSerializer},
    )
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
        job = AutomationJob.objects.prefetch_related(
            "artifacts__workspace", "artifacts__page", "artifacts__file_asset"
        ).get(pk=job.pk)
        data = dict(AutomationJobSerializer(job).data)
        if job.status == AutomationJob.Status.FAILED:
            data["error_code"] = job.error_summary
            return Response(data, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(data, status=status.HTTP_201_CREATED)


def visible_automation_jobs(workspace, user):
    project_ids = visible_project_ids(workspace, user)
    return (
        AutomationJob.objects.filter(workspace=workspace)
        .filter(Q(project__isnull=True) | Q(project_id__in=project_ids))
        .select_related("template", "project")
        .prefetch_related("artifacts__workspace", "artifacts__page", "artifacts__file_asset")
    )


class AutomationJobDetailView(WorkspaceContextMixin, SummonAPIView):
    permission_classes = [SummonWorkspacePermission]

    @extend_schema(
        description="Get one document automation job and its generated artifacts.",
        responses={200: AutomationJobSerializer},
    )
    def get(self, request, slug, job_id):
        job = get_object_or_404(visible_automation_jobs(self.get_workspace(), request.user), id=job_id)
        return Response(AutomationJobSerializer(job).data)


class AutomationContextExtractView(WorkspaceContextMixin, SummonAPIView):
    summon_tool = "none"  # binary upload
    permission_classes = [SummonWorkspacePermission]

    @extend_schema(
        description="Extract text from an uploaded document to use as automation context.",
        request={"multipart/form-data": inline_serializer("ContextDocumentUpload", {"file": serializers.FileField()})},
        responses={200: ContextDocumentSerializer},
    )
    def post(self, request, slug):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"file": "Select a document."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(extract_context_document(upload))


class AutomationPublishView(WorkspaceContextMixin, SummonAPIView):
    permission_classes = [SummonWorkspacePermission]

    @extend_schema(
        summary="Publish automation job",
        description="Publish a generated preview you requested as a Plane page or file.",
        request=None,
        responses={200: AutomationJobSerializer},
    )
    def post(self, request, slug, job_id):
        job = get_object_or_404(
            AutomationJob,
            id=job_id,
            workspace=self.get_workspace(),
            requested_by=request.user,
        )
        publish_job(job, request.user)
        job = AutomationJob.objects.prefetch_related(
            "artifacts__workspace", "artifacts__page", "artifacts__file_asset"
        ).get(pk=job.pk)
        return Response(AutomationJobSerializer(job).data)


class AutomationRenderView(WorkspaceContextMixin, SummonAPIView):
    permission_classes = [SummonWorkspacePermission]

    def post(self, request, slug, job_id):
        job = get_object_or_404(
            AutomationJob,
            id=job_id,
            workspace=self.get_workspace(),
            requested_by=request.user,
        )
        render_job_files(job, request.user)
        job = AutomationJob.objects.prefetch_related(
            "artifacts__workspace", "artifacts__page", "artifacts__file_asset"
        ).get(pk=job.pk)
        return Response(AutomationJobSerializer(job).data)


class GeneratedArtifactDownloadView(WorkspaceContextMixin, SummonAPIView):
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


class ReportSummaryView(WorkspaceContextMixin, SummonAPIView):
    permission_classes = [require_capability("reports.view")]

    @extend_schema(
        description="Delivery and commercial report for the workspace, filterable by project, client and date range.",
        parameters=[ReportFilterSerializer],
        responses={
            200: OpenApiResponse(OpenApiTypes.OBJECT, description="Portfolio, pipeline and due-date aggregates.")
        },
    )
    def get(self, request, slug):
        serializer = ReportFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        return Response(report_summary(self.get_workspace(), request.user, serializer.validated_data))


class ReportExportView(WorkspaceContextMixin, SummonAPIView):
    summon_tool = "none"  # CSV download; ReportSummaryView serves the same data as JSON
    permission_classes = [require_capability("reports.view")]

    @extend_schema(
        description="The report as CSV.",
        parameters=[ReportFilterSerializer],
        responses={(200, "text/csv"): OpenApiTypes.STR},
    )
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


class LLMStatusView(SummonAPIView):
    permission_classes = [require_capability("settings.view")]

    @extend_schema(
        summary="AI provider status",
        description="Whether the workspace AI provider is configured, and which provider and model it uses.",
        responses={200: LLMStatusSerializer},
    )
    def get(self, request, slug):
        return Response(get_llm_configuration_status())


class AssistantQueryView(WorkspaceContextMixin, SummonAPIView):
    summon_tool = {"POST": "read"}  # deterministic read-only intents
    permission_classes = [SummonWorkspacePermission]

    @extend_schema(
        description=(
            "Answer a structured question from Summon data without the AI model; "
            "see `intent` for the supported questions."
        ),
        request=AssistantQuerySerializer,
        responses={200: AssistantQueryResultSerializer},
    )
    def post(self, request, slug):
        serializer = AssistantQuerySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(answer_query(self.get_workspace(), request.user, **serializer.validated_data))
