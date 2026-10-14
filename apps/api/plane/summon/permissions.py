# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission

from plane.summon.access import require_capability

SummonWorkspacePermission = require_capability("workspace.view", "workspace.edit")


class AIServicePermission(BasePermission):
    """The caller is the Summon AI service (apps/ai), proven by the shared internal token."""

    header = "X-Summon-AI-Token"

    def has_permission(self, request, view):
        expected = settings.SUMMON_AI_INTERNAL_TOKEN
        provided = request.headers.get(self.header, "")
        return bool(expected) and hmac.compare_digest(provided.encode(), expected.encode())
