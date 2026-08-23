# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import models

from plane.db.models import BaseModel


class SummonWorkspaceSettings(BaseModel):
    workspace = models.OneToOneField(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="summon_settings",
    )
    industry = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)
    currency = models.CharField(max_length=3, default="IDR")
    workweek = models.JSONField(default=list, blank=True)
