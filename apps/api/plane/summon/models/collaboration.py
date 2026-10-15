# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta

from django.db import models
from django.utils import timezone

from plane.db.models import BaseModel
from plane.summon.models.credential import Credential


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
    summary_error = models.CharField(max_length=80, blank=True)
    summary_provider = models.CharField(max_length=40, blank=True)
    summary_model = models.CharField(max_length=120, blank=True)
    summary_input_tokens = models.PositiveIntegerField(null=True, blank=True)
    summary_output_tokens = models.PositiveIntegerField(null=True, blank=True)
    external_source = models.CharField(max_length=255, null=True, blank=True)
    external_id = models.CharField(max_length=255, null=True, blank=True)
    # People an importer saw on the invite ({name, email}), including those outside the workspace; members among
    # them are also linked as participants.
    attendees = models.JSONField(default=list, blank=True)

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
    page = models.ForeignKey("db.Page", on_delete=models.CASCADE, related_name="summon_contexts")
    project = models.ForeignKey("db.Project", null=True, blank=True, on_delete=models.SET_NULL)
    client = models.ForeignKey("summon.Client", null=True, blank=True, on_delete=models.SET_NULL)
    opportunity = models.ForeignKey("summon.Opportunity", null=True, blank=True, on_delete=models.SET_NULL)
    category = models.CharField(max_length=80, blank=True)
    tags = models.JSONField(default=list, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("page",),
                condition=models.Q(deleted_at__isnull=True),
                name="summon_unique_page_context",
            )
        ]


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


class DriveFolder(BaseModel):
    """A Google Drive folder, or a single Doc, Sheet or Slides file, read through a member's Google account, whose
    content becomes project pages."""

    class Kind(models.TextChoices):
        FOLDER = "folder", "Folder"
        FILE = "file", "File"

    class Health(models.TextChoices):
        OK = "ok", "OK"
        REVOKED = "revoked", "Google access revoked"
        ERROR = "error", "Sync failed"
        STALLED = "stalled", "Sync stalled"

    # The periodic sync runs every 15 minutes; an hour without a successful one means it has stopped running.
    STALLED_AFTER = timedelta(hours=1)

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_drive_folders")
    project = models.ForeignKey("db.Project", on_delete=models.CASCADE, related_name="summon_drive_folders")
    credential = models.ForeignKey("summon.Credential", on_delete=models.PROTECT, related_name="drive_folders")
    kind = models.CharField(max_length=8, choices=Kind.choices, default=Kind.FOLDER)
    # The folder's Drive ID, or the file's for a single-file source.
    folder_id = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    # Every folder under `folder_id`, itself included: a change belongs here when its parent is one of them.
    folder_ids = models.JSONField(default=list, blank=True)
    # Shared drives have their own change feed; empty means the account's own "My Drive" feed.
    drive_id = models.CharField(max_length=255, blank=True)
    page_token = models.CharField(max_length=255, blank=True)
    channel_id = models.CharField(max_length=64, blank=True)
    channel_resource_id = models.CharField(max_length=255, blank=True)
    channel_token = models.CharField(max_length=255, blank=True)
    channel_expires_at = models.DateTimeField(null=True, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    sync_error = models.CharField(max_length=80, blank=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("workspace", "folder_id"),
                condition=models.Q(deleted_at__isnull=True),
                name="summon_unique_drive_folder",
            )
        ]

    @property
    def health(self):
        if self.credential.status != Credential.Status.ACTIVE or self.sync_error == "drive_auth_revoked":
            return self.Health.REVOKED
        if self.sync_error:
            return self.Health.ERROR
        # A source still on its first import is not stalled until it has had as long as any other.
        if (self.last_synced_at or self.created_at) < timezone.now() - self.STALLED_AFTER:
            return self.Health.STALLED
        return self.Health.OK


class DriveFile(BaseModel):
    """One synced Drive file and the page that holds its content."""

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_drive_files")
    folder = models.ForeignKey(DriveFolder, on_delete=models.CASCADE, related_name="files")
    page = models.ForeignKey("db.Page", on_delete=models.CASCADE, related_name="summon_drive_files")
    file_id = models.CharField(max_length=255)
    modified_time = models.CharField(max_length=40)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("folder", "file_id"),
                condition=models.Q(deleted_at__isnull=True),
                name="summon_unique_drive_file",
            )
        ]
