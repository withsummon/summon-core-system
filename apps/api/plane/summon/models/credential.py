# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models

from plane.db.models import BaseModel


class Credential(BaseModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        REVOKED = "revoked", "Revoked"

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_credentials")
    project = models.ForeignKey("db.Project", null=True, blank=True, on_delete=models.SET_NULL)
    owner = models.ForeignKey("db.User", null=True, blank=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=255)
    provider = models.CharField(max_length=120)
    account_identifier = models.CharField(max_length=255, blank=True)
    secret_ciphertext = models.TextField()
    key_version = models.PositiveIntegerField(default=1)
    metadata = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("name",)


class CredentialGrant(BaseModel):
    class Permission(models.TextChoices):
        VIEW = "view", "View"
        USE = "use", "Use"
        MANAGE = "manage", "Manage"

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="summon_credential_grants")
    credential = models.ForeignKey(Credential, on_delete=models.CASCADE, related_name="grants")
    member = models.ForeignKey("db.User", on_delete=models.CASCADE, related_name="summon_credential_grants")
    granted_by = models.ForeignKey(
        "db.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="summon_grants_given"
    )
    permission = models.CharField(max_length=16, choices=Permission.choices, default=Permission.USE)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("credential", "member"),
                condition=models.Q(deleted_at__isnull=True),
                name="summon_unique_credential_grant",
            )
        ]


class CredentialAccessLog(BaseModel):
    workspace = models.ForeignKey(
        "db.Workspace", on_delete=models.CASCADE, related_name="summon_credential_access_logs"
    )
    credential = models.ForeignKey(Credential, on_delete=models.PROTECT, related_name="access_logs")
    member = models.ForeignKey("db.User", null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=80)
    reason = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)
