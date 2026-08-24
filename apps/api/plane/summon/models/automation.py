# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models

from plane.db.models import BaseModel


class AutomationTemplate(BaseModel):
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_automation_templates")
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=80)
    description = models.TextField(blank=True)
    content_template = models.TextField()
    variables = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    external_source = models.CharField(max_length=255, null=True, blank=True)
    external_id = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("workspace", "name"),
                condition=models.Q(deleted_at__isnull=True),
                name="summon_unique_template_name",
            )
        ]


class AutomationJob(BaseModel):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_automation_jobs")
    template = models.ForeignKey(
        AutomationTemplate, null=True, blank=True, on_delete=models.SET_NULL, related_name="jobs"
    )
    project = models.ForeignKey("db.Project", null=True, blank=True, on_delete=models.SET_NULL)
    requested_by = models.ForeignKey("db.User", null=True, blank=True, on_delete=models.SET_NULL)
    type = models.CharField(max_length=80)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED)
    input = models.JSONField(default=dict, blank=True)
    preview_markdown = models.TextField(blank=True)
    provider = models.CharField(max_length=40, blank=True)
    model = models.CharField(max_length=120, blank=True)
    input_tokens = models.PositiveIntegerField(null=True, blank=True)
    output_tokens = models.PositiveIntegerField(null=True, blank=True)
    error_summary = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)


class GeneratedArtifact(BaseModel):
    class Format(models.TextChoices):
        PAGE = "page", "Page"
        PDF = "pdf", "PDF"
        DOCX = "docx", "DOCX"
        XLSX = "xlsx", "XLSX"
        PPTX = "pptx", "PPTX"

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_generated_artifacts")
    job = models.ForeignKey(AutomationJob, on_delete=models.CASCADE, related_name="artifacts")
    project = models.ForeignKey("db.Project", null=True, blank=True, on_delete=models.SET_NULL)
    page = models.ForeignKey("db.Page", null=True, blank=True, on_delete=models.CASCADE)
    file_asset = models.ForeignKey("db.FileAsset", null=True, blank=True, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    kind = models.CharField(max_length=80)
    format = models.CharField(max_length=8, choices=Format.choices, default=Format.PAGE)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("job", "format"),
                condition=models.Q(deleted_at__isnull=True),
                name="summon_unique_artifact_job_format",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(format="page", page__isnull=False, file_asset__isnull=True)
                    | models.Q(
                        format__in=("pdf", "docx", "xlsx", "pptx"),
                        page__isnull=True,
                        file_asset__isnull=False,
                    )
                ),
                name="summon_artifact_exactly_one_target",
            ),
        ]
