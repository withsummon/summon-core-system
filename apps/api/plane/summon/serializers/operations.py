# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from plane.api.serializers.base import BaseSerializer
from plane.summon.serializers.shapes import CitationSerializer, GeneratedFileRefSerializer, GeneratedPageRefSerializer
from plane.db.models import Project, ProjectMember
from plane.summon.models import (
    AssistantAction,
    AssistantAttachment,
    AssistantConversation,
    AssistantMessage,
    AutomationJob,
    AutomationTemplate,
    GeneratedArtifact,
)
from plane.summon.services.assistant import SUPPORTED_DETERMINISTIC_INTENTS
from plane.summon.services.credential import can_use
from plane.summon.services.reports import visible_project_ids
from plane.summon.services.page_document import summon_document_metadata


class ReportFilterSerializer(serializers.Serializer):
    project_id = serializers.UUIDField(required=False)
    client_id = serializers.UUIDField(required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)

    def validate(self, attrs):
        if attrs.get("date_from") and attrs.get("date_to") and attrs["date_from"] > attrs["date_to"]:
            raise serializers.ValidationError({"date_to": "Must be on or after date_from."})
        return attrs


class PageFilterSerializer(serializers.Serializer):
    project_id = serializers.UUIDField(required=False, help_text="Only pages in this project.")
    search = serializers.CharField(required=False, help_text="Only pages whose name contains this text.")


class AutomationTemplateSerializer(BaseSerializer):
    class Meta:
        model = AutomationTemplate
        fields = ["id", "name", "type", "description", "content_template", "variables", "is_active"]


class AssistantContextSerializer(serializers.Serializer):
    workspace = serializers.BooleanField(required=False, default=False)
    project_id = serializers.UUIDField(required=False, allow_null=True)
    client_id = serializers.UUIDField(required=False, allow_null=True)
    meeting_id = serializers.UUIDField(required=False, allow_null=True)
    page_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
        max_length=20,
    )


class AutomationRunSerializer(serializers.Serializer):
    template = serializers.PrimaryKeyRelatedField(queryset=AutomationTemplate.objects.all())
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all(), required=False, allow_null=True)
    input = serializers.JSONField(required=False, default=dict)
    context = AssistantContextSerializer(required=False, default=dict)

    def validate(self, attrs):
        workspace = self.context["workspace"]
        user = self.context["request"].user
        template = attrs["template"]
        project = attrs.get("project")
        errors = {}
        if not isinstance(attrs["input"], dict):
            errors["input"] = "Automation input must be an object."
        if template.workspace_id != workspace.id or not template.is_active:
            errors["template"] = "Active template must belong to this workspace."
        if not project:
            errors["error_code"] = "project_required"
            errors["project"] = "Select an authorized Plane Project before generating a preview."
        if project and (
            project.workspace_id != workspace.id
            or not ProjectMember.objects.filter(
                workspace=workspace,
                project=project,
                member=user,
                role__in=[20, 15],
                is_active=True,
            ).exists()
        ):
            errors["project"] = "Active Project membership is required."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class MeetingSummaryRequestSerializer(serializers.Serializer):
    transcript_source = serializers.ChoiceField(choices=("text", "asset"), required=False)
    context = AssistantContextSerializer(required=False, default=dict)


class GeneratedArtifactSerializer(BaseSerializer):
    page_detail = serializers.SerializerMethodField()
    file_detail = serializers.SerializerMethodField()

    class Meta:
        model = GeneratedArtifact
        fields = ["id", "title", "kind", "format", "page", "file_asset", "page_detail", "file_detail"]
        read_only_fields = fields

    @extend_schema_field(GeneratedPageRefSerializer(allow_null=True))
    def get_page_detail(self, instance):
        if not instance.page:
            return None
        metadata = summon_document_metadata(instance.page)
        return {
            "id": str(instance.page_id),
            "name": instance.page.name,
            "markdown": metadata.get("markdown", ""),
            "href": (
                f"/{instance.workspace.slug}/projects/{instance.project_id}/pages/{instance.page_id}/"
                if instance.project_id
                else f"/{instance.workspace.slug}/summon/knowledge/"
            ),
        }

    @extend_schema_field(GeneratedFileRefSerializer(allow_null=True))
    def get_file_detail(self, instance):
        if not instance.file_asset_id:
            return None
        attributes = instance.file_asset.attributes
        return {
            "name": attributes.get("name", "document"),
            "content_type": attributes.get("type", "application/octet-stream"),
            "size": int(attributes.get("size", instance.file_asset.size)),
            "href": (f"/api/workspaces/{instance.workspace.slug}/summon/generated-artifacts/{instance.id}/download/"),
        }


class AutomationJobSerializer(BaseSerializer):
    artifacts = GeneratedArtifactSerializer(many=True, read_only=True)
    input = serializers.SerializerMethodField()
    citations = serializers.SerializerMethodField()
    context_truncated = serializers.SerializerMethodField()

    class Meta:
        model = AutomationJob
        fields = [
            "id",
            "template",
            "project",
            "type",
            "status",
            "input",
            "preview_markdown",
            "provider",
            "model",
            "input_tokens",
            "output_tokens",
            "error_summary",
            "started_at",
            "completed_at",
            "published_at",
            "citations",
            "context_truncated",
            "artifacts",
            "created_at",
        ]
        read_only_fields = fields

    @extend_schema_field(OpenApiTypes.OBJECT)
    def get_input(self, instance):
        return instance.input.get("values", instance.input)

    @extend_schema_field(CitationSerializer(many=True))
    def get_citations(self, instance):
        return instance.input.get("citations", [])

    @extend_schema_field(OpenApiTypes.BOOL)
    def get_context_truncated(self, instance):
        return bool(instance.input.get("context_truncated", False))


class AssistantQuerySerializer(serializers.Serializer):
    # Unknown intents answer "unsupported" instead of failing validation, so this stays a CharField.
    intent = serializers.CharField(
        max_length=80, help_text="One of: " + ", ".join(sorted(SUPPORTED_DETERMINISTIC_INTENTS)) + "."
    )
    query = serializers.CharField(
        required=False, allow_blank=True, default="", help_text="Page name text for knowledge_page_lookup."
    )
    project_id = serializers.UUIDField(required=False, allow_null=True, help_text="Required for project_summary.")


class AssistantAttachmentSerializer(BaseSerializer):
    class Meta:
        model = AssistantAttachment
        fields = ["id", "message", "original_name", "media_type", "size", "status", "language", "error", "created_at"]
        read_only_fields = fields


class AssistantMessageSerializer(BaseSerializer):
    attachments = AssistantAttachmentSerializer(many=True, read_only=True)
    automation_job = AutomationJobSerializer(read_only=True, allow_null=True)

    class Meta:
        model = AssistantMessage
        fields = [
            "id",
            "role",
            "content",
            "citations",
            "provider",
            "model",
            "input_tokens",
            "output_tokens",
            "status",
            "error_code",
            "parts",
            "usage",
            "attachments",
            "automation_job",
            "created_at",
        ]
        read_only_fields = fields


class AssistantActionSerializer(BaseSerializer):
    class Meta:
        model = AssistantAction
        fields = [
            "id",
            "tool",
            "arguments",
            "preview",
            "status",
            "confirmed_at",
            "result",
            "error",
            "created_at",
        ]
        read_only_fields = fields


class AssistantConversationListSerializer(BaseSerializer):
    class Meta:
        model = AssistantConversation
        fields = [
            "id",
            "title",
            "project",
            "client",
            "mcp_credential",
            "last_activity_at",
        ]
        read_only_fields = ["id", "last_activity_at"]

    def validate(self, attrs):
        workspace = self.context["workspace"]
        user = self.context["request"].user
        errors = {}
        project = attrs.get("project")
        client = attrs.get("client")
        credential = attrs.get("mcp_credential", self.instance.mcp_credential if self.instance else None)
        if project and (project.workspace_id != workspace.id or project.id not in visible_project_ids(workspace, user)):
            errors["project"] = "Active Project membership is required."
        if client and client.workspace_id != workspace.id:
            errors["client"] = "Client must belong to this workspace."
        if credential and (
            credential.workspace_id != workspace.id
            or credential.status != credential.Status.ACTIVE
            or credential.provider not in {"plane", "plane_mcp"}
            or not can_use(credential, user)
        ):
            errors["mcp_credential"] = "Select an active Plane PAT you are allowed to use."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class AssistantConversationSerializer(AssistantConversationListSerializer):
    messages = AssistantMessageSerializer(many=True, read_only=True)
    actions = AssistantActionSerializer(many=True, read_only=True)
    attachments = AssistantAttachmentSerializer(many=True, read_only=True)

    class Meta(AssistantConversationListSerializer.Meta):
        fields = [*AssistantConversationListSerializer.Meta.fields, "messages", "actions", "attachments"]
        read_only_fields = [
            *AssistantConversationListSerializer.Meta.read_only_fields,
            "messages",
            "actions",
            "attachments",
        ]


class AssistantTurnStartSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=20000, trim_whitespace=False)
    context = AssistantContextSerializer(required=False, default=dict)
    attachment_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
        max_length=5,
    )


class AssistantMessageRequestSerializer(AssistantTurnStartSerializer):
    intent = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    tool = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    arguments = serializers.JSONField(required=False, default=dict)

    def validate_arguments(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Tool arguments must be an object.")
        return value


class TurnHistoryEntrySerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=AssistantMessage.Role.choices)
    content = serializers.CharField(allow_blank=True)


class TurnContextSerializer(serializers.Serializer):
    text = serializers.CharField(allow_blank=True, help_text="Retrieved records the model may answer from.")
    citations = CitationSerializer(many=True)
    truncated = serializers.BooleanField()


class AssistantTurnSerializer(serializers.Serializer):
    user_message = AssistantMessageSerializer()
    assistant_message = AssistantMessageSerializer(help_text="The streaming placeholder the AI service completes.")
    history = TurnHistoryEntrySerializer(
        many=True, help_text="Completed messages, oldest first, ending with this turn."
    )
    context = TurnContextSerializer()


class AssistantTurnCompleteSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[AssistantMessage.Status.COMPLETED.value, AssistantMessage.Status.FAILED.value]
    )
    content = serializers.CharField(allow_blank=True, trim_whitespace=False, max_length=200000)
    parts = serializers.ListField(child=serializers.JSONField(), required=False, default=list, max_length=500)
    provider = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    model = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    input_tokens = serializers.IntegerField(min_value=0, required=False, allow_null=True, default=None)
    output_tokens = serializers.IntegerField(min_value=0, required=False, allow_null=True, default=None)
    usage = serializers.JSONField(required=False, default=dict)
    error_code = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if attrs["status"] == AssistantMessage.Status.FAILED and not attrs["error_code"]:
            raise serializers.ValidationError({"error_code": "A failed turn needs an error code."})
        if not isinstance(attrs["usage"], dict):
            raise serializers.ValidationError({"usage": "Usage must be an object."})
        return attrs


class PlaneToolCallSerializer(serializers.Serializer):
    tool = serializers.CharField(max_length=120, help_text="Plane MCP tool, e.g. workitem or project.")
    arguments = serializers.JSONField(help_text="Tool arguments, including `action`.")

    def validate_arguments(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Tool arguments must be an object.")
        return value


class PlaneToolResultSerializer(serializers.Serializer):
    result = serializers.JSONField(allow_null=True, help_text="Read result; null when the call became an action.")
    action = AssistantActionSerializer(allow_null=True, help_text="Pending write the user must confirm.")


class AIConfigSerializer(serializers.Serializer):
    provider = serializers.CharField()
    model = serializers.CharField()
    api_key = serializers.CharField(allow_blank=True)
    base_url = serializers.CharField(allow_blank=True)
    timeout_seconds = serializers.IntegerField()
