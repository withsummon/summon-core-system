# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.api.serializers.base import BaseSerializer
from plane.db.models import Project, ProjectMember
from plane.summon.models import AutomationJob, AutomationTemplate, GeneratedArtifact


class AutomationTemplateSerializer(BaseSerializer):
    class Meta:
        model = AutomationTemplate
        fields = ["id", "name", "type", "description", "content_template", "variables", "is_active"]


class AutomationRunSerializer(serializers.Serializer):
    template = serializers.PrimaryKeyRelatedField(queryset=AutomationTemplate.objects.all())
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all(), required=False, allow_null=True)
    input = serializers.JSONField(required=False, default=dict)

    def validate(self, attrs):
        workspace = self.context["workspace"]
        user = self.context["request"].user
        template = attrs["template"]
        project = attrs.get("project")
        errors = {}
        if template.workspace_id != workspace.id or not template.is_active:
            errors["template"] = "Active template must belong to this workspace."
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


class GeneratedArtifactSerializer(BaseSerializer):
    page_detail = serializers.SerializerMethodField()

    class Meta:
        model = GeneratedArtifact
        fields = ["id", "title", "kind", "page", "file_asset", "page_detail"]
        read_only_fields = fields

    def get_page_detail(self, instance):
        if not instance.page:
            return None
        return {
            "id": str(instance.page_id),
            "name": instance.page.name,
            "markdown": instance.page.description_json.get("markdown", ""),
        }


class AutomationJobSerializer(BaseSerializer):
    artifacts = GeneratedArtifactSerializer(many=True, read_only=True)

    class Meta:
        model = AutomationJob
        fields = [
            "id",
            "template",
            "project",
            "type",
            "status",
            "input",
            "error_summary",
            "started_at",
            "completed_at",
            "artifacts",
            "created_at",
        ]
        read_only_fields = fields


class AssistantQuerySerializer(serializers.Serializer):
    intent = serializers.CharField(max_length=80)
    query = serializers.CharField(required=False, allow_blank=True, default="")
    project_id = serializers.UUIDField(required=False, allow_null=True)
