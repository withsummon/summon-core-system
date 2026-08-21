# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.api.serializers.base import BaseSerializer
from plane.db.models import WorkspaceMember
from plane.summon.models import Client, ClientContact, Opportunity, SummonProjectProfile


class WorkspaceScopedSerializer(BaseSerializer):
    @property
    def workspace(self):
        return self.context["workspace"]

    def is_workspace_member(self, member):
        return (
            not member
            or WorkspaceMember.objects.filter(
                workspace=self.workspace,
                member=member,
                is_active=True,
            ).exists()
        )

    def is_workspace_record(self, record):
        return not record or record.workspace_id == self.workspace.id


class ClientSerializer(WorkspaceScopedSerializer):
    class Meta:
        model = Client
        fields = "__all__"
        read_only_fields = ["workspace", "created_by", "updated_by", "deleted_at"]

    def validate(self, attrs):
        if not self.is_workspace_member(attrs.get("owner")):
            raise serializers.ValidationError({"owner": "Member must belong to this workspace."})
        return attrs


class ClientContactSerializer(WorkspaceScopedSerializer):
    class Meta:
        model = ClientContact
        fields = "__all__"
        read_only_fields = ["workspace", "client", "created_by", "updated_by", "deleted_at"]


class OpportunitySerializer(WorkspaceScopedSerializer):
    class Meta:
        model = Opportunity
        fields = "__all__"
        read_only_fields = ["workspace", "created_by", "updated_by", "deleted_at"]

    def validate(self, attrs):
        errors = {}
        if not self.is_workspace_record(attrs.get("client")):
            errors["client"] = "Record must belong to this workspace."
        if not self.is_workspace_member(attrs.get("owner")):
            errors["owner"] = "Member must belong to this workspace."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class OpportunityTransitionSerializer(serializers.Serializer):
    stage = serializers.ChoiceField(choices=Opportunity.Stage.choices)
    probability = serializers.IntegerField(min_value=0, max_value=100, required=False)


class SummonProjectProfileSerializer(WorkspaceScopedSerializer):
    class Meta:
        model = SummonProjectProfile
        fields = "__all__"
        read_only_fields = ["workspace", "project", "created_by", "updated_by", "deleted_at"]

    def validate(self, attrs):
        errors = {}
        if not self.is_workspace_record(attrs.get("client")):
            errors["client"] = "Record must belong to this workspace."
        if not self.is_workspace_record(attrs.get("source_opportunity")):
            errors["source_opportunity"] = "Record must belong to this workspace."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs
