# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.api.serializers.base import BaseSerializer
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

    def get_input(self, instance):
        return instance.input.get("values", instance.input)

    def get_citations(self, instance):
        return instance.input.get("citations", [])

    def get_context_truncated(self, instance):
        return bool(instance.input.get("context_truncated", False))


class AssistantQuerySerializer(serializers.Serializer):
    intent = serializers.CharField(max_length=80)
    query = serializers.CharField(required=False, allow_blank=True, default="")
    project_id = serializers.UUIDField(required=False, allow_null=True)


class AssistantMessageSerializer(BaseSerializer):
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
            "created_at",
        ]
        read_only_fields = fields


class AssistantAttachmentSerializer(BaseSerializer):
    class Meta:
        model = AssistantAttachment
        fields = ["id", "message", "original_name", "media_type", "size", "status", "language", "error", "created_at"]
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


class AssistantConversationSerializer(BaseSerializer):
    messages = AssistantMessageSerializer(many=True, read_only=True)
    actions = AssistantActionSerializer(many=True, read_only=True)

    class Meta:
        model = AssistantConversation
        fields = ["id", "title", "project", "client", "mcp_credential", "last_activity_at", "messages", "actions"]
        read_only_fields = ["id", "last_activity_at", "messages", "actions"]

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


class AssistantMessageRequestSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=20000, trim_whitespace=False)
    context = AssistantContextSerializer(required=False, default=dict)
    intent = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    tool = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    arguments = serializers.JSONField(required=False, default=dict)

    def validate_arguments(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Tool arguments must be an object.")
        return value
