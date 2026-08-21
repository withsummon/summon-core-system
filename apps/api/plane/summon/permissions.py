# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework.permissions import BasePermission, SAFE_METHODS

from plane.db.models import WorkspaceMember


class SummonWorkspacePermission(BasePermission):
    def has_permission(self, request, view):
        if request.user.is_anonymous:
            return False

        roles = [20, 15, 5] if request.method in SAFE_METHODS else [20, 15]
        return WorkspaceMember.objects.filter(
            workspace__slug=view.kwargs.get("slug"),
            member=request.user,
            role__in=roles,
            is_active=True,
        ).exists()
