# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""OAuth for MCP clients: they sign people in through the browser instead of asking for an API key.

The access token an MCP client receives is a Plane API token for one workspace, so Django, the AI
service and the Plane MCP server check it exactly as they check a key someone created by hand. Deleting
that token under the profile's API tokens signs the client out.

These rows are credentials, so they are deleted for real: unlike `BaseModel` they have no soft delete.
"""

import uuid

from django.db import models

from plane.db.mixins import TimeAuditModel


class OAuthClient(TimeAuditModel):
    """An MCP client that registered itself (RFC 7591). Public clients only: they prove themselves with PKCE."""

    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)
    name = models.CharField(max_length=255)
    redirect_uris = models.JSONField(default=list)


class OAuthCode(TimeAuditModel):
    """A one-time authorization code, stored hashed. Exchanging it deletes it."""

    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)
    code_hash = models.CharField(max_length=64, unique=True)
    client = models.ForeignKey(OAuthClient, on_delete=models.CASCADE, related_name="codes")
    user = models.ForeignKey("db.User", on_delete=models.CASCADE, related_name="+")
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="+")
    redirect_uri = models.TextField()
    code_challenge = models.CharField(max_length=128)
    expires_at = models.DateTimeField()


class OAuthGrant(TimeAuditModel):
    """One sign-in of a client: its API token (the access token) and its refresh token, stored hashed."""

    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)
    client = models.ForeignKey(OAuthClient, on_delete=models.CASCADE, related_name="grants")
    api_token = models.OneToOneField("db.APIToken", on_delete=models.CASCADE, related_name="oauth_grant")
    refresh_token_hash = models.CharField(max_length=64, unique=True)
    refresh_expires_at = models.DateTimeField()
