# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.db.models import ProjectMember
from plane.summon.models import MeetingWorkItem


def link_work_item(meeting, issue, actor):
    if issue.deleted_at or issue.workspace_id != meeting.workspace_id:
        raise serializers.ValidationError({"issue": "Issue must belong to this workspace."})
    if meeting.project_id and issue.project_id != meeting.project_id:
        raise serializers.ValidationError({"issue": "Issue must belong to the meeting Project."})
    if not ProjectMember.objects.filter(
        workspace_id=meeting.workspace_id,
        project_id=issue.project_id,
        member=actor,
        role__in=[20, 15],
        is_active=True,
    ).exists():
        raise serializers.ValidationError({"issue": "Active Project membership is required."})
    if MeetingWorkItem.objects.filter(meeting=meeting, issue=issue).exists():
        raise serializers.ValidationError({"issue": "Issue is already linked to this meeting."})

    item = MeetingWorkItem(workspace=meeting.workspace, meeting=meeting, issue=issue)
    item.save(created_by_id=actor.id)
    return item
