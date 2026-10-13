# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Read-only shapes for the nested objects Summon serializers build by hand.

They document `SerializerMethodField` results and hand-built view responses in the Summon OpenAPI
schema (the contract for the generated client and AI tools). The response contract tests validate
real responses against them, so a shape that drifts from its producer fails a test.
"""

from rest_framework import serializers


class ProjectRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    identifier = serializers.CharField()
    name = serializers.CharField()


class MemberRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    display_name = serializers.CharField()


class UserRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    display_name = serializers.CharField()
    avatar_url = serializers.CharField(allow_null=True)


class AssetRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField(allow_blank=True)
    url = serializers.CharField(allow_null=True)


class PageRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField(allow_blank=True)


class CitationSerializer(serializers.Serializer):
    """A permission-checked source the assistant used (`services/context.py` `_citation`)."""

    id = serializers.CharField()
    label = serializers.CharField(allow_blank=True)
    href = serializers.CharField(allow_blank=True)
    kind = serializers.CharField()


class MeetingParticipantRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    member = MemberRefSerializer()
    response = serializers.CharField()


class WorkItemStateRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    group = serializers.CharField()


class WorkItemRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    sequence_id = serializers.IntegerField()
    project = ProjectRefSerializer()
    state = WorkItemStateRefSerializer(allow_null=True)
    completed = serializers.BooleanField()


class MeetingWorkItemReadSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    issue = WorkItemRefSerializer()
    created_at = serializers.DateTimeField()


class MeetingSummaryPageSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField(allow_blank=True)
    markdown = serializers.CharField(allow_blank=True)
    summary = serializers.CharField(allow_blank=True)
    decisions = serializers.ListField(child=serializers.JSONField())
    action_suggestions = serializers.ListField(child=serializers.JSONField())
    discussion_topics = serializers.ListField(child=serializers.JSONField())
    todos_by_party = serializers.ListField(child=serializers.JSONField())
    open_items = serializers.ListField(child=serializers.JSONField())
    next_actions = serializers.ListField(child=serializers.JSONField())
    citations = serializers.ListField(child=serializers.JSONField())
    context_truncated = serializers.BooleanField()
    href = serializers.CharField()


class GeneratedPageRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField(allow_blank=True)
    markdown = serializers.CharField(allow_blank=True)
    href = serializers.CharField()


class GeneratedFileRefSerializer(serializers.Serializer):
    name = serializers.CharField()
    content_type = serializers.CharField()
    size = serializers.IntegerField()
    href = serializers.CharField()


class ActivityRefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    label = serializers.CharField()
    created_at = serializers.DateTimeField()
    href = serializers.CharField()


class ErrorCodeSerializer(serializers.Serializer):
    """Error body with a stable machine-readable code the UI maps to copy."""

    error_code = serializers.CharField()


class StatusConflictSerializer(serializers.Serializer):
    status = serializers.CharField()
