# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models
from django.utils import timezone

from plane.db.models import BaseModel


class AssistantConversation(BaseModel):
    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="summon_assistant_conversations",
    )
    owner = models.ForeignKey(
        "db.User",
        on_delete=models.CASCADE,
        related_name="summon_assistant_conversations",
    )
    project = models.ForeignKey("db.Project", null=True, blank=True, on_delete=models.SET_NULL)
    client = models.ForeignKey("summon.Client", null=True, blank=True, on_delete=models.SET_NULL)
    mcp_credential = models.ForeignKey("summon.Credential", null=True, blank=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=255)
    last_activity_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ("-last_activity_at",)


class AssistantMessage(BaseModel):
    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"

    class Status(models.TextChoices):
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    conversation = models.ForeignKey(
        AssistantConversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="summon_assistant_messages",
    )
    role = models.CharField(max_length=12, choices=Role.choices)
    content = models.TextField()
    citations = models.JSONField(default=list)
    provider = models.CharField(max_length=40, blank=True)
    model = models.CharField(max_length=120, blank=True)
    input_tokens = models.PositiveIntegerField(null=True, blank=True)
    output_tokens = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.COMPLETED)

    class Meta:
        ordering = ("created_at",)


class AssistantAction(BaseModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        FAILED = "failed", "Failed"

    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="summon_assistant_actions",
    )
    conversation = models.ForeignKey(
        AssistantConversation,
        on_delete=models.CASCADE,
        related_name="actions",
    )
    requester = models.ForeignKey(
        "db.User",
        on_delete=models.CASCADE,
        related_name="summon_assistant_actions",
    )
    tool = models.CharField(max_length=120)
    arguments = models.JSONField(default=dict)
    preview = models.JSONField(default=dict)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    result = models.JSONField(default=dict, blank=True)
    error = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ("created_at",)
