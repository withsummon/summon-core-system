# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models

from plane.db.models import BaseModel


class Meeting(BaseModel):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_meetings")
    project = models.ForeignKey(
        "db.Project", null=True, blank=True, on_delete=models.SET_NULL, related_name="summon_meetings"
    )
    organizer = models.ForeignKey("db.User", null=True, blank=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=255)
    agenda = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    meeting_url = models.URLField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.SCHEDULED)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    recording_asset = models.ForeignKey(
        "db.FileAsset",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="summon_meeting_recordings",
    )
    transcript_asset = models.ForeignKey(
        "db.FileAsset",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="summon_meeting_transcripts",
    )
    summary_page = models.ForeignKey(
        "db.Page",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="summon_meeting_summaries",
    )

    class Meta:
        ordering = ("-starts_at",)


class MeetingParticipant(BaseModel):
    class Response(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_meeting_participants")
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name="participants")
    member = models.ForeignKey("db.User", on_delete=models.CASCADE, related_name="summon_meetings")
    response = models.CharField(max_length=16, choices=Response.choices, default=Response.PENDING)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("meeting", "member"),
                condition=models.Q(deleted_at__isnull=True),
                name="summon_unique_meeting_participant",
            )
        ]


class MeetingWorkItem(BaseModel):
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_meeting_work_items")
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name="work_items")
    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="summon_meetings")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("meeting", "issue"),
                condition=models.Q(deleted_at__isnull=True),
                name="summon_unique_meeting_issue",
            )
        ]


class SummonPageContext(BaseModel):
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_page_contexts")
    page = models.OneToOneField("db.Page", on_delete=models.CASCADE, related_name="summon_context")
    project = models.ForeignKey("db.Project", null=True, blank=True, on_delete=models.SET_NULL)
    client = models.ForeignKey("summon.Client", null=True, blank=True, on_delete=models.SET_NULL)
    opportunity = models.ForeignKey("summon.Opportunity", null=True, blank=True, on_delete=models.SET_NULL)
    category = models.CharField(max_length=80, blank=True)
    tags = models.JSONField(default=list, blank=True)


class ResourceLink(BaseModel):
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_resource_links")
    project = models.ForeignKey("db.Project", null=True, blank=True, on_delete=models.CASCADE)
    page = models.ForeignKey("db.Page", null=True, blank=True, on_delete=models.CASCADE)
    client = models.ForeignKey("summon.Client", null=True, blank=True, on_delete=models.CASCADE)
    credential = models.ForeignKey("summon.Credential", null=True, blank=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=255)
    url = models.URLField()
    description = models.TextField(blank=True)
    category = models.CharField(max_length=80, blank=True)

    class Meta:
        ordering = ("title",)
