# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.db.models import Workspace
from plane.summon.models import SummonWorkspaceSettings


WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


class SummonWorkspaceSettingsSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80)
    slug = serializers.SlugField(read_only=True)
    logo = serializers.CharField(read_only=True, allow_null=True)
    organization_size = serializers.CharField(max_length=20, allow_blank=True, allow_null=True, required=False)
    timezone = serializers.ChoiceField(choices=Workspace.TIMEZONE_CHOICES, required=False)
    industry = serializers.CharField(max_length=120, allow_blank=True, required=False)
    description = serializers.CharField(allow_blank=True, required=False)
    currency = serializers.CharField(min_length=3, max_length=3, required=False)
    workweek = serializers.ListField(
        child=serializers.ChoiceField(choices=WEEKDAYS),
        allow_empty=True,
        required=False,
    )

    def validate_workweek(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError("Workweek days must be unique.")
        return value

    def to_representation(self, workspace):
        extension, _ = SummonWorkspaceSettings.objects.get_or_create(workspace=workspace)
        return {
            "name": workspace.name,
            "slug": workspace.slug,
            "logo": workspace.logo_url,
            "organization_size": workspace.organization_size,
            "timezone": workspace.timezone,
            "industry": extension.industry,
            "description": extension.description,
            "currency": extension.currency,
            "workweek": extension.workweek,
        }

    def update(self, workspace, validated_data):
        for field in ("name", "organization_size", "timezone"):
            if field in validated_data:
                setattr(workspace, field, validated_data.pop(field))
        workspace.save(update_fields=["name", "organization_size", "timezone", "updated_at"])
        extension, _ = SummonWorkspaceSettings.objects.get_or_create(workspace=workspace)
        for field in ("industry", "description", "currency", "workweek"):
            if field in validated_data:
                setattr(extension, field, validated_data[field])
        extension.save()
        return workspace
