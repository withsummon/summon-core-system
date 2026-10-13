# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Workspace users and roles, owned by Summon on top of Plane's membership tables.

Rules every write enforces: nobody changes their own access (so an admin always remains),
the workspace owner keeps admin, nobody is deactivated while they are a project's only
admin, and each change leaves an immutable `SummonAccessEvent`. Restoring a user returns
workspace access only; project access stays revoked until a project admin adds them back.
"""

import secrets

from django.db import transaction
from django.db.models import Exists, OuterRef
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response

from plane.app.views.base import BaseAPIView
from plane.db.models import Project, ProjectMember, User, WorkspaceMember, WorkspaceMemberInvite
from plane.summon.access import ADMIN, GUEST, ROLE_LABELS, active_membership, capabilities_for, require_capability
from plane.summon.models import SummonAccessEvent
from plane.summon.views.commercial import WorkspaceContextMixin

Kind = SummonAccessEvent.Kind


class AccessMeView(BaseAPIView):
    permission_classes = [require_capability("workspace.view")]

    def get(self, request, slug):
        role = active_membership(request.user, slug).role
        return Response({"role": role, "role_label": ROLE_LABELS[role], "capabilities": capabilities_for(role)})


class WorkspaceUsersView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [require_capability("users.view", "users.manage")]

    def get(self, request, slug):
        workspace = self.get_workspace()
        members = (
            WorkspaceMember.objects.filter(workspace=workspace, member__is_bot=False)
            .select_related("member")
            .order_by("-is_active", "-role", "member__first_name", "member__email")
        )
        invites = WorkspaceMemberInvite.objects.filter(workspace=workspace).order_by("-created_at")
        return Response(
            {
                "members": [_member_data(m, workspace, request.user) for m in members],
                "invites": [_invite_data(i) for i in invites],
            }
        )

    def post(self, request, slug):
        data = _validated(InviteSerializer, request.data)
        email, role = data["email"], data["role"]
        workspace = self.get_workspace()

        with transaction.atomic():
            user = User.objects.filter(email=email).first()
            membership = user and WorkspaceMember.objects.filter(workspace=workspace, member=user).first()
            if membership:
                code = "already_member" if membership.is_active else "deactivated_member"
                return Response({"error_code": code}, status=status.HTTP_409_CONFLICT)
            if WorkspaceMemberInvite.objects.filter(workspace=workspace, email=email).exists():
                return Response({"error_code": "already_invited"}, status=status.HTTP_409_CONFLICT)

            if user:
                # They already have an account, so they join now instead of on next sign-in.
                membership = WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
                _record(request, workspace, Kind.ADDED, email, user=user, to_role=role)
                return Response(_member_data(membership, workspace, request.user), status=status.HTTP_201_CREATED)

            # accepted=True lets Plane's sign-in flow both admit the new email past the signup
            # gate and join it to this workspace on first Google sign-in.
            invite = WorkspaceMemberInvite.objects.create(
                workspace=workspace, email=email, role=role, accepted=True, token=secrets.token_urlsafe(32)
            )
            _record(request, workspace, Kind.INVITED, email, to_role=role)
        return Response(_invite_data(invite), status=status.HTTP_201_CREATED)


class WorkspaceUserDetailView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [require_capability("users.manage")]

    def patch(self, request, slug, pk):
        data = _validated(MemberUpdateSerializer, request.data)
        workspace = self.get_workspace()

        with transaction.atomic():
            # Lock the workspace's members so two admins can't demote each other at once.
            members = list(
                WorkspaceMember.objects.select_for_update(of=("self",))
                .select_related("member")
                .filter(workspace=workspace)
            )
            target = next((m for m in members if str(m.id) == str(pk)), None)
            if target is None or target.member.is_bot:
                return Response({"error_code": "not_found"}, status=status.HTTP_404_NOT_FOUND)

            refusal = _refusal(request, workspace, members, target, data)
            if refusal:
                return Response({"error_code": refusal}, status=status.HTTP_409_CONFLICT)

            email = target.member.email
            if "role" in data and data["role"] != target.role:
                from_role, target.role = target.role, data["role"]
                if target.role == GUEST:
                    # Plane's rule: a workspace guest is a guest in every project too.
                    ProjectMember.objects.filter(workspace=workspace, member=target.member).update(role=GUEST)
                target.save(update_fields=["role", "updated_at"])
                _record(request, workspace, Kind.ROLE_CHANGED, email, target.member, from_role, target.role)

            if "is_active" in data and data["is_active"] != target.is_active:
                target.is_active = data["is_active"]
                if not target.is_active:
                    ProjectMember.objects.filter(workspace=workspace, member=target.member, is_active=True).update(
                        is_active=False, updated_at=timezone.now()
                    )
                target.save(update_fields=["is_active", "updated_at"])
                kind = Kind.RESTORED if target.is_active else Kind.DEACTIVATED
                _record(request, workspace, kind, email, target.member, to_role=target.role)

        return Response(_member_data(target, workspace, request.user))


class WorkspaceInviteDetailView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [require_capability("users.manage")]

    def delete(self, request, slug, pk):
        workspace = self.get_workspace()
        invite = WorkspaceMemberInvite.objects.filter(workspace=workspace, pk=pk).first()
        if invite is None:
            return Response({"error_code": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            invite.delete()
            _record(request, workspace, Kind.INVITE_REVOKED, invite.email, from_role=invite.role)
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkspaceAccessHistoryView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [require_capability("users.view")]

    def get(self, request, slug):
        events = SummonAccessEvent.objects.filter(workspace=self.get_workspace()).select_related("actor")[:100]
        return Response(
            [
                {
                    "id": str(e.id),
                    "kind": e.kind,
                    "actor": e.actor and {"name": _name(e.actor), "email": e.actor.email},
                    "target_email": e.target_email,
                    "from_role": e.from_role,
                    "to_role": e.to_role,
                    "created_at": e.created_at,
                }
                for e in events
            ]
        )


ROLE_CHOICES = sorted(ROLE_LABELS)


class InviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=ROLE_CHOICES)

    def validate_email(self, value):
        return value.strip().lower()


class MemberUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=ROLE_CHOICES, required=False)
    is_active = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Send role or is_active.")
        return attrs


def _validated(serializer_class, data):
    serializer = serializer_class(data=data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


def _refusal(request, workspace, members, target, data):
    """Return why this change is refused, or None."""
    if target.member_id == request.user.id:
        return "cannot_change_self"
    # Re-read under the lock: another admin may have demoted this one since the permission check.
    # Since nobody can change themselves, an admin acting here also means one admin always remains.
    if not any(m.member_id == request.user.id and m.is_active and m.role == ADMIN for m in members):
        return "not_admin"
    loses_admin = target.role == ADMIN and (data.get("role", ADMIN) != ADMIN or data.get("is_active") is False)
    if loses_admin and target.member_id == workspace.owner_id:
        return "workspace_owner"
    if data.get("is_active") is False and _sole_project_admin(workspace, target.member):
        return "sole_project_admin"
    return None


def _sole_project_admin(workspace, user):
    other_admins = ProjectMember.objects.filter(project=OuterRef("pk"), role=ADMIN, is_active=True).exclude(member=user)
    return (
        Project.objects.filter(
            workspace=workspace,
            project_projectmember__member=user,
            project_projectmember__role=ADMIN,
            project_projectmember__is_active=True,
        )
        .exclude(Exists(other_admins))
        .exists()
    )


def _record(request, workspace, kind, email, user=None, from_role=None, to_role=None):
    SummonAccessEvent.objects.create(
        workspace=workspace,
        actor=request.user,
        target_user=user,
        target_email=email,
        kind=kind,
        from_role=from_role,
        to_role=to_role,
    )


def _member_data(membership, workspace, viewer):
    user = membership.member
    return {
        "id": str(membership.id),
        "user_id": str(user.id),
        "email": user.email,
        "name": _name(user),
        "avatar_url": user.avatar_url,
        "role": membership.role,
        "is_active": membership.is_active,
        "is_owner": user.id == workspace.owner_id,
        "is_you": user.id == viewer.id,
        "joined_at": membership.created_at,
        "last_signed_in": user.last_login_time,
    }


def _name(user):
    return f"{user.first_name} {user.last_name}".strip() or user.display_name or user.email


def _invite_data(invite):
    return {"id": str(invite.id), "email": invite.email, "role": invite.role, "invited_at": invite.created_at}
