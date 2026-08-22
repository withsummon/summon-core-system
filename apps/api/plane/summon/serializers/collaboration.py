# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from urllib.parse import urlparse

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from django.utils.html import escape
from rest_framework import serializers

from plane.api.serializers.base import BaseSerializer
from plane.db.models import Page, ProjectMember, ProjectPage, WorkspaceMember
from plane.summon.models import (
    Meeting,
    MeetingParticipant,
    MeetingWorkItem,
    ResourceLink,
    SummonPageContext,
)
from plane.summon.services.page_document import summon_document_metadata, write_page_document


class CollaborationSerializer(BaseSerializer):
    @property
    def workspace(self):
        return self.context["workspace"]

    @property
    def user(self):
        return self.context["request"].user

    def value(self, attrs, field):
        return attrs[field] if field in attrs else getattr(self.instance, field, None)

    def is_workspace_record(self, record):
        return not record or (record.workspace_id == self.workspace.id and record.deleted_at is None)

    def is_project_member(self, project, write=True):
        if not project:
            return True
        roles = [20, 15] if write else [20, 15, 5]
        return (
            self.is_workspace_record(project)
            and ProjectMember.objects.filter(
                workspace=self.workspace,
                project=project,
                member=self.user,
                role__in=roles,
                is_active=True,
            ).exists()
        )

    def is_accessible_page(self, page):
        if not self.is_workspace_record(page):
            return False
        if not page or page.owned_by_id == self.user.id:
            return True
        if page.access == Page.PRIVATE_ACCESS:
            return False
        return (
            page.is_global
            or ProjectMember.objects.filter(
                project__pages=page,
                member=self.user,
                is_active=True,
            ).exists()
        )

    def is_accessible_asset(self, asset):
        if not self.is_workspace_record(asset):
            return False
        if not asset:
            return True
        if asset.is_deleted or asset.is_archived or not asset.is_uploaded:
            return False
        return not asset.project_id or self.is_project_member(asset.project, write=False)

    def is_text_asset(self, asset):
        name = asset.attributes.get("name", str(asset.asset)).lower()
        content_type = asset.attributes.get("content_type", asset.attributes.get("mime_type", "")).lower()
        return content_type.startswith("text/") or name.endswith(
            (".txt", ".md", ".text", ".srt", ".vtt", ".csv", ".json", ".xml", ".yaml", ".yml", ".log")
        )


class MeetingWorkItemSerializer(BaseSerializer):
    class Meta:
        model = MeetingWorkItem
        fields = ["id", "issue", "created_at"]
        read_only_fields = ["id", "created_at"]

    def to_representation(self, instance):
        state = instance.issue.state
        return {
            "id": str(instance.id),
            "issue": {
                "id": str(instance.issue_id),
                "name": instance.issue.name,
                "sequence_id": instance.issue.sequence_id,
                "project": {
                    "id": str(instance.issue.project_id),
                    "identifier": instance.issue.project.identifier,
                    "name": instance.issue.project.name,
                },
                "state": ({"id": str(state.id), "name": state.name, "group": state.group} if state else None),
                "completed": bool(state and state.group == "completed"),
            },
            "created_at": instance.created_at,
        }


class MeetingSerializer(CollaborationSerializer):
    participant_ids = serializers.ListField(child=serializers.UUIDField(), write_only=True, required=False)
    transcript = serializers.CharField(allow_blank=True, required=False, trim_whitespace=False, write_only=True)
    participants = serializers.SerializerMethodField()
    work_items = serializers.SerializerMethodField()
    project_detail = serializers.SerializerMethodField()
    recording_asset_detail = serializers.SerializerMethodField()
    transcript_asset_detail = serializers.SerializerMethodField()
    transcript_text = serializers.SerializerMethodField()
    summary_page_detail = serializers.SerializerMethodField()

    class Meta:
        model = Meeting
        fields = [
            "id",
            "title",
            "agenda",
            "notes",
            "location",
            "meeting_url",
            "status",
            "starts_at",
            "ends_at",
            "project",
            "project_detail",
            "recording_asset",
            "recording_asset_detail",
            "transcript_asset",
            "transcript_asset_detail",
            "summary_page",
            "summary_page_detail",
            "summary_error",
            "summary_provider",
            "summary_model",
            "summary_input_tokens",
            "summary_output_tokens",
            "transcript",
            "transcript_text",
            "organizer",
            "participant_ids",
            "participants",
            "work_items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["organizer", "created_at", "updated_at"]

    def validate(self, attrs):
        errors = {}
        project = self.value(attrs, "project")
        if not self.is_project_member(project):
            errors["project"] = "Active Project membership is required."
        if "transcript" in attrs and not project:
            errors["project"] = "Link an authorized Plane Project before adding a transcript."
        for field in ("recording_asset", "transcript_asset"):
            if not self.is_accessible_asset(self.value(attrs, field)):
                errors[field] = "Asset must be accessible in this workspace."
        transcript_asset = self.value(attrs, "transcript_asset")
        if transcript_asset and self.is_accessible_asset(transcript_asset) and not self.is_text_asset(transcript_asset):
            errors["transcript_asset"] = "Transcript asset must be a text file."
        if not self.is_accessible_page(self.value(attrs, "summary_page")):
            errors["summary_page"] = "Page must be accessible in this workspace."

        starts_at = self.value(attrs, "starts_at")
        ends_at = self.value(attrs, "ends_at")
        if starts_at and ends_at and ends_at < starts_at:
            errors["ends_at"] = "End time must not be before start time."

        participant_ids = attrs.get("participant_ids")
        if participant_ids is not None:
            active_ids = set(
                WorkspaceMember.objects.filter(
                    workspace=self.workspace,
                    member_id__in=participant_ids,
                    is_active=True,
                ).values_list("member_id", flat=True)
            )
            if active_ids != set(participant_ids):
                errors["participant_ids"] = "Participants must be active workspace members."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        participant_ids = validated_data.pop("participant_ids", [])
        transcript = validated_data.pop("transcript", None)
        meeting = Meeting.objects.create(
            **validated_data,
            workspace=self.workspace,
            organizer=self.user,
        )
        self._replace_participants(meeting, participant_ids)
        if transcript is not None:
            self._replace_transcript(meeting, transcript)
        return meeting

    def update(self, instance, validated_data):
        participant_ids = validated_data.pop("participant_ids", None)
        transcript = validated_data.pop("transcript", None)
        instance = super().update(instance, validated_data)
        if participant_ids is not None:
            self._replace_participants(instance, participant_ids)
        if transcript is not None:
            self._replace_transcript(instance, transcript)
        return instance

    def _replace_participants(self, meeting, participant_ids):
        MeetingParticipant.objects.filter(meeting=meeting).delete()
        MeetingParticipant.objects.bulk_create(
            [
                MeetingParticipant(
                    workspace=self.workspace,
                    meeting=meeting,
                    member_id=member_id,
                    created_by=self.user,
                )
                for member_id in participant_ids
            ]
        )

    def _replace_transcript(self, meeting, transcript):
        page = meeting.summary_page
        marker = str(meeting.id)
        page_marker = page.view_props if page else {}
        if (
            not page
            or page.owned_by_id != self.user.id
            or marker
            not in {
                page_marker.get("summon_transcript_meeting_id"),
                page_marker.get("summon_summary_meeting_id"),
            }
        ):
            page = Page(
                workspace=self.workspace,
                owned_by=self.user,
                name=f"{meeting.title} transcript",
                access=Page.PRIVATE_ACCESS,
                is_global=False,
                view_props={"full_width": False, "summon_transcript_meeting_id": marker},
            )
        page.name = f"{meeting.title} transcript"
        page.view_props = {
            **(page.view_props if isinstance(page.view_props, dict) else {}),
            "full_width": False,
            "summon_transcript_meeting_id": marker,
        }
        write_page_document(
            page,
            escape(transcript).replace("\n", "<br />"),
            {"kind": "summon_meeting_transcript", "source_transcript": transcript},
        )
        ProjectPage.objects.get_or_create(workspace=self.workspace, project=meeting.project, page=page)
        meeting.summary_page = page
        meeting.summary_error = ""
        meeting.summary_provider = ""
        meeting.summary_model = ""
        meeting.summary_input_tokens = None
        meeting.summary_output_tokens = None
        meeting.save(
            update_fields=[
                "summary_page",
                "summary_error",
                "summary_provider",
                "summary_model",
                "summary_input_tokens",
                "summary_output_tokens",
                "updated_at",
            ]
        )

    def get_participants(self, instance):
        return [
            {
                "id": str(participant.id),
                "member": {
                    "id": str(participant.member_id),
                    "display_name": participant.member.display_name,
                },
                "response": participant.response,
            }
            for participant in instance.participants.select_related("member").all()
        ]

    def get_work_items(self, instance):
        project_ids = ProjectMember.objects.filter(
            workspace=self.workspace,
            member=self.user,
            is_active=True,
        ).values_list("project_id", flat=True)
        items = instance.work_items.filter(
            issue__deleted_at__isnull=True, issue__project_id__in=project_ids
        ).select_related("issue__state", "issue__project")
        return MeetingWorkItemSerializer(items, many=True).data

    def get_project_detail(self, instance):
        if not instance.project:
            return None
        return {
            "id": str(instance.project_id),
            "identifier": instance.project.identifier,
            "name": instance.project.name,
        }

    def _asset_detail(self, asset):
        if not asset:
            return None
        return {"id": str(asset.id), "name": asset.attributes.get("name", ""), "url": asset.asset_url}

    def get_recording_asset_detail(self, instance):
        return self._asset_detail(instance.recording_asset)

    def get_transcript_asset_detail(self, instance):
        return self._asset_detail(instance.transcript_asset)

    def _is_canonical_meeting_page(self, instance):
        page = instance.summary_page
        props = page.view_props if page and isinstance(page.view_props, dict) else {}
        marker = str(instance.id)
        return marker in {
            props.get("summon_transcript_meeting_id"),
            props.get("summon_summary_meeting_id"),
        }

    def get_transcript_text(self, instance):
        page = instance.summary_page
        if not self._is_canonical_meeting_page(instance) or not self.is_accessible_page(page):
            return ""
        data = summon_document_metadata(page)
        source = data.get("source_transcript")
        if isinstance(source, str):
            return source
        if page.view_props.get("summon_transcript_meeting_id") == str(instance.id):
            return page.description_stripped or ""
        return ""

    def get_summary_page_detail(self, instance):
        if not self._is_canonical_meeting_page(instance) or not self.is_accessible_page(instance.summary_page):
            return None
        data = summon_document_metadata(instance.summary_page)
        return {
            "id": str(instance.summary_page_id),
            "name": instance.summary_page.name,
            "markdown": data.get("markdown", ""),
            "summary": data.get("summary", ""),
            "decisions": data.get("decisions", []),
            "action_suggestions": data.get("action_suggestions", []),
            "citations": data.get("citations", []),
            "context_truncated": bool(data.get("context_truncated", False)),
            "href": (
                f"/{self.workspace.slug}/projects/{instance.project_id}/pages/{instance.summary_page_id}/"
                if instance.project_id
                else f"/{self.workspace.slug}/summon/knowledge/"
            ),
        }


class SummonPageContextSerializer(CollaborationSerializer):
    page_detail = serializers.SerializerMethodField()

    class Meta:
        model = SummonPageContext
        fields = [
            "id",
            "page",
            "page_detail",
            "project",
            "client",
            "opportunity",
            "category",
            "tags",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        errors = {}
        if not self.is_accessible_page(self.value(attrs, "page")):
            errors["page"] = "Page must be accessible in this workspace."
        if not self.is_project_member(self.value(attrs, "project")):
            errors["project"] = "Active Project membership is required."
        for field in ("client", "opportunity"):
            if not self.is_workspace_record(self.value(attrs, field)):
                errors[field] = "Record must belong to this workspace."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    def get_page_detail(self, instance):
        return {"id": str(instance.page_id), "name": instance.page.name}


class ResourceLinkSerializer(CollaborationSerializer):
    class Meta:
        model = ResourceLink
        fields = [
            "id",
            "project",
            "page",
            "client",
            "credential",
            "title",
            "url",
            "description",
            "category",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate_url(self, value):
        if urlparse(value).scheme not in {"http", "https"}:
            raise serializers.ValidationError("Only http and https URLs are allowed.")
        try:
            URLValidator(schemes=["http", "https"])(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError("Enter a valid external URL.") from exc
        return value

    def validate(self, attrs):
        errors = {}
        blocked = {"file", "asset", "upload"} & set(self.initial_data)
        if blocked:
            errors[next(iter(blocked))] = "Files must use Plane FileAsset."
        if not self.is_project_member(self.value(attrs, "project")):
            errors["project"] = "Active Project membership is required."
        if not self.is_accessible_page(self.value(attrs, "page")):
            errors["page"] = "Page must be accessible in this workspace."
        for field in ("client", "credential"):
            if not self.is_workspace_record(self.value(attrs, field)):
                errors[field] = "Record must belong to this workspace."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs
