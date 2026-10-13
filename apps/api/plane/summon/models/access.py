# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.core.exceptions import ValidationError
from django.db import models

from plane.db.models import BaseModel


class SummonAccessEvent(BaseModel):
    """Who changed whose workspace access, and how. Rows are never edited or deleted."""

    class Kind(models.TextChoices):
        INVITED = "invited", "Invited"
        INVITE_REVOKED = "invite_revoked", "Invite revoked"
        ADDED = "added", "Added"
        ROLE_CHANGED = "role_changed", "Role changed"
        DEACTIVATED = "deactivated", "Deactivated"
        RESTORED = "restored", "Restored"

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_access_events")
    actor = models.ForeignKey("db.User", null=True, on_delete=models.SET_NULL, related_name="+")
    target_user = models.ForeignKey("db.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    # Kept even when the user exists: invites have no user yet, and the email survives account deletion.
    target_email = models.CharField(max_length=255)
    kind = models.CharField(max_length=32, choices=Kind.choices)
    from_role = models.PositiveSmallIntegerField(null=True, blank=True)
    to_role = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("Access events are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Access events are immutable.")
