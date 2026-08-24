# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.api.serializers.base import BaseSerializer
from plane.db.models import WorkspaceMember
from plane.summon.models import Client, ClientContact, Opportunity, SummonProjectProfile
from plane.summon.serializers.collaboration import (
    MeetingSerializer,
    MeetingWorkItemSerializer,
    SummonPageContextSerializer,
)
from plane.summon.services.commercial import (
    detail_activity,
    detail_meetings,
    detail_page_contexts,
    detail_project_profile,
    detail_work_items,
    visible_linked_projects,
)


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
        return not record or (record.workspace_id == self.workspace.id and record.deleted_at is None)

    def value(self, attrs, field):
        return attrs[field] if field in attrs else getattr(self.instance, field, None)


class ClientSerializer(WorkspaceScopedSerializer):
    class Meta:
        model = Client
        fields = "__all__"
        read_only_fields = ["workspace", "created_by", "updated_by", "deleted_at"]

    def validate(self, attrs):
        if not self.is_workspace_member(self.value(attrs, "owner")):
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
        if not self.is_workspace_record(self.value(attrs, "client")):
            errors["client"] = "Record must belong to this workspace."
        if not self.is_workspace_member(self.value(attrs, "owner")):
            errors["owner"] = "Member must belong to this workspace."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class ClientDetailSerializer(ClientSerializer):
    contacts = serializers.SerializerMethodField()
    opportunities = serializers.SerializerMethodField()
    projects = serializers.SerializerMethodField()
    meetings = serializers.SerializerMethodField()
    page_contexts = serializers.SerializerMethodField()
    recent_activity = serializers.SerializerMethodField()

    class Meta(ClientSerializer.Meta):
        fields = "__all__"

    def get_contacts(self, instance):
        return ClientContactSerializer(
            instance.contacts.filter(workspace=self.workspace), many=True, context=self.context
        ).data

    def get_opportunities(self, instance):
        return OpportunitySerializer(
            instance.opportunities.filter(workspace=self.workspace), many=True, context=self.context
        ).data

    def get_projects(self, instance):
        return [
            {"id": str(project.id), "identifier": project.identifier, "name": project.name}
            for project in visible_linked_projects(instance, self.context["request"].user, "client")
        ]

    def get_meetings(self, instance):
        return MeetingSerializer(
            detail_meetings(instance, self.context["request"].user, "client"), many=True, context=self.context
        ).data

    def get_page_contexts(self, instance):
        return SummonPageContextSerializer(
            detail_page_contexts(instance, self.context["request"].user, "client"), many=True, context=self.context
        ).data

    def get_recent_activity(self, instance):
        return detail_activity(instance, self.context["request"].user, "client")


class OpportunityDetailSerializer(OpportunitySerializer):
    client_detail = serializers.SerializerMethodField()
    contacts = serializers.SerializerMethodField()
    project_profile = serializers.SerializerMethodField()
    meetings = serializers.SerializerMethodField()
    page_contexts = serializers.SerializerMethodField()
    work_items = serializers.SerializerMethodField()
    recent_activity = serializers.SerializerMethodField()

    class Meta(OpportunitySerializer.Meta):
        fields = "__all__"

    def get_client_detail(self, instance):
        return ClientSerializer(instance.client, context=self.context).data if instance.client else None

    def get_contacts(self, instance):
        if not instance.client:
            return []
        return ClientContactSerializer(
            instance.client.contacts.filter(workspace=self.workspace), many=True, context=self.context
        ).data

    def get_project_profile(self, instance):
        profile = detail_project_profile(instance, self.context["request"].user)
        return SummonProjectProfileSerializer(profile, context=self.context).data if profile else None

    def get_meetings(self, instance):
        return MeetingSerializer(
            detail_meetings(instance, self.context["request"].user, "source_opportunity"),
            many=True,
            context=self.context,
        ).data

    def get_page_contexts(self, instance):
        return SummonPageContextSerializer(
            detail_page_contexts(instance, self.context["request"].user, "opportunity"), many=True, context=self.context
        ).data

    def get_work_items(self, instance):
        return MeetingWorkItemSerializer(detail_work_items(instance, self.context["request"].user), many=True).data

    def get_recent_activity(self, instance):
        return detail_activity(instance, self.context["request"].user, "source_opportunity")


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
        if not self.is_workspace_record(self.value(attrs, "client")):
            errors["client"] = "Record must belong to this workspace."
        if not self.is_workspace_record(self.value(attrs, "source_opportunity")):
            errors["source_opportunity"] = "Record must belong to this workspace."
        start_date = self.value(attrs, "start_date")
        target_date = self.value(attrs, "target_date")
        if start_date and target_date and start_date > target_date:
            errors["target_date"] = "Target date must not be before start date."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs
