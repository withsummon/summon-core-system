# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Summon's capability map: the one place that says what each workspace role may do.

Roles stay Plane's stored values (Admin 20, Member 15, Guest 5) so every Plane permission
check keeps working. Summon code asks for a capability instead of comparing role numbers,
and the web reads the same answer from `access/me/` rather than keeping its own copy.
"""

from rest_framework.permissions import BasePermission

from plane.db.models import WorkspaceMember

ADMIN, MEMBER, GUEST = 20, 15, 5

ROLE_LABELS = {ADMIN: "Admin", MEMBER: "Member", GUEST: "Guest"}

CAPABILITIES = {
    "workspace.view": {ADMIN, MEMBER, GUEST},
    "workspace.edit": {ADMIN, MEMBER},
    "credentials.view": {ADMIN, MEMBER},
    # Opportunities and every money figure (deal values, project budgets, pipeline totals).
    "commercial.view": {ADMIN},
    "reports.view": {ADMIN},
    "settings.view": {ADMIN},
    "settings.edit": {ADMIN},
    "users.view": {ADMIN},
    "users.manage": {ADMIN},
}


def capabilities_for(role):
    return sorted(name for name, roles in CAPABILITIES.items() if role in roles)


def active_membership(user, slug):
    if user.is_anonymous:
        return None
    return (
        WorkspaceMember.objects.filter(
            workspace__slug=slug,
            workspace__deleted_at__isnull=True,
            member=user,
            is_active=True,
        )
        .select_related("workspace")
        .first()
    )


def has_capability(user, slug, capability):
    membership = active_membership(user, slug)
    return bool(membership) and membership.role in CAPABILITIES[capability]


def require_capability(read, write=None):
    """DRF permission class: `read` guards safe methods, `write` (default: `read`) the rest."""

    class CapabilityPermission(BasePermission):
        def has_permission(self, request, view):
            capability = read if request.method in ("GET", "HEAD", "OPTIONS") else (write or read)
            return has_capability(request.user, view.kwargs.get("slug"), capability)

    CapabilityPermission.__name__ = f"Requires_{read.replace('.', '_')}"
    return CapabilityPermission
