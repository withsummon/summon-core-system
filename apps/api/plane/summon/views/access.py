# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Workspace users and roles, owned by Summon on top of Plane's membership tables.

Rules every write enforces: nobody changes their own access (so an admin always remains),
the workspace owner keeps admin, nobody is deactivated while they are a project's only
admin, and each change leaves an immutable `SummonAccessEvent`. Restoring a user returns
workspace access only; project access stays revoked until a project admin adds them back.

Project access always matches the workspace role (Plane's rule). An email without an account
yet waits on projects as Plane's accepted `ProjectMemberInvite`, which first sign-in turns
into membership, the same way the workspace invite does.
"""

import secrets

from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema, extend_schema_field
from rest_framework import serializers, status
from rest_framework.response import Response

from plane.summon.views.base import SummonAPIView
from plane.db.models import (
    Project,
    ProjectMember,
    ProjectMemberInvite,
    User,
    WorkspaceMember,
    WorkspaceMemberInvite,
)
from plane.summon.access import (
    ADMIN,
    GUEST,
    ROLE_LABELS,
    active_membership,
    capabilities_for,
    has_capability,
    require_capability,
)
from plane.summon.models import SummonAccessEvent
from plane.summon.serializers.shapes import ErrorCodeSerializer, ProjectRefSerializer
from plane.summon.views.commercial import WorkspaceContextMixin

Kind = SummonAccessEvent.Kind


ROLE_CHOICES = sorted(ROLE_LABELS.items())


class AccessMeSerializer(serializers.Serializer):
    role = serializers.IntegerField()
    role_label = serializers.CharField()
    capabilities = serializers.ListField(child=serializers.CharField())


class NameField(serializers.CharField):
    """A user's display name: full name, else display name, else email."""

    def to_representation(self, user):
        return f"{user.first_name} {user.last_name}".strip() or user.display_name or user.email


@extend_schema_field(ProjectRefSerializer(many=True))
class PersonProjectsField(serializers.Field):
    """The person's projects, from the `projects` context map keyed by `key` (member id or invite email)."""

    def __init__(self, key):
        self.key = key
        super().__init__(source="*", read_only=True)

    def to_representation(self, row):
        return ProjectRefSerializer(self.context["projects"].get(getattr(row, self.key), []), many=True).data


# A `WorkspaceMember`; context carries `workspace`, `viewer` and `projects` by member id.
class WorkspaceMemberRowSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    user_id = serializers.UUIDField(source="member_id")
    email = serializers.EmailField(source="member.email")
    name = NameField(source="member")
    avatar_url = serializers.CharField(source="member.avatar_url", allow_null=True)
    role = serializers.IntegerField()
    is_active = serializers.BooleanField()
    is_owner = serializers.SerializerMethodField()
    is_you = serializers.SerializerMethodField()
    joined_at = serializers.DateTimeField(source="created_at")
    last_signed_in = serializers.DateTimeField(source="member.last_login_time", allow_null=True)
    projects = PersonProjectsField("member_id")

    @extend_schema_field(serializers.BooleanField())
    def get_is_owner(self, membership):
        return membership.member_id == self.context["workspace"].owner_id

    @extend_schema_field(serializers.BooleanField())
    def get_is_you(self, membership):
        return membership.member_id == self.context["viewer"].id


# A `WorkspaceMemberInvite`; context carries `projects` by email.
class WorkspaceInviteRowSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    role = serializers.IntegerField()
    invited_at = serializers.DateTimeField(source="created_at")
    projects = PersonProjectsField("email")


class WorkspaceUsersSerializer(serializers.Serializer):
    members = WorkspaceMemberRowSerializer(many=True)
    invites = WorkspaceInviteRowSerializer(many=True)


class ProjectMemberRowSerializer(serializers.Serializer):
    user_id = serializers.UUIDField(source="member_id")
    name = NameField(source="member")
    email = serializers.EmailField(source="member.email")
    avatar_url = serializers.CharField(source="member.avatar_url", allow_null=True)
    role = serializers.IntegerField()


class ProjectInviteRowSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    role = serializers.IntegerField()
    invited_at = serializers.DateTimeField(source="created_at")


class ProjectPeopleSerializer(serializers.Serializer):
    members = ProjectMemberRowSerializer(many=True)
    invites = ProjectInviteRowSerializer(many=True)


class AccessActorSerializer(serializers.Serializer):
    name = NameField(source="*")
    email = serializers.EmailField()


class AccessEventSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    kind = serializers.CharField()
    actor = AccessActorSerializer(allow_null=True)
    target_email = serializers.CharField()
    from_role = serializers.IntegerField(allow_null=True)
    to_role = serializers.IntegerField(allow_null=True)
    created_at = serializers.DateTimeField()


class InviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=ROLE_CHOICES)
    project_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)

    def validate_email(self, value):
        return value.strip().lower()


class ProjectPersonSerializer(serializers.Serializer):
    """Exactly one of: a workspace member to add, or an email to invite as a guest."""

    member_id = serializers.UUIDField(required=False)
    email = serializers.EmailField(required=False)

    def validate_email(self, value):
        return value.strip().lower()

    def validate(self, attrs):
        if len(attrs) != 1:
            raise serializers.ValidationError("Send member_id or email.")
        return attrs


class MemberUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=ROLE_CHOICES, required=False)
    is_active = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Send role or is_active.")
        return attrs


class AccessMeView(SummonAPIView):
    permission_classes = [require_capability("workspace.view")]

    @extend_schema(
        summary="My workspace access",
        description="Your role in this workspace and what Summon lets you do.",
        responses={200: AccessMeSerializer},
    )
    def get(self, request, slug):
        role = active_membership(request.user, slug).role
        access = {"role": role, "role_label": ROLE_LABELS[role], "capabilities": capabilities_for(role)}
        return Response(AccessMeSerializer(access).data)


class WorkspaceUsersView(WorkspaceContextMixin, SummonAPIView):
    summon_tool = {"POST": "none"}  # access changes stay with people, never AI tools
    permission_classes = [require_capability("users.view", "users.manage")]

    @extend_schema(
        summary="List workspace members",
        description="Workspace members with their roles and projects, plus pending invites.",
        responses={200: WorkspaceUsersSerializer},
    )
    def get(self, request, slug):
        workspace = self.get_workspace()
        members = (
            WorkspaceMember.objects.filter(workspace=workspace, member__is_bot=False)
            .select_related("member")
            .order_by("-is_active", "-role", "member__first_name", "member__email")
        )
        invites = WorkspaceMemberInvite.objects.filter(workspace=workspace).order_by("-created_at")
        projects = _projects_by_person(workspace)
        context = {"workspace": workspace, "viewer": request.user, "projects": projects}
        return Response(WorkspaceUsersSerializer({"members": members, "invites": invites}, context=context).data)

    @extend_schema(
        description="Invite people to the workspace by email, optionally onto projects.",
        request=InviteSerializer,
        responses={
            201: PolymorphicProxySerializer(
                "WorkspaceInviteResult", [WorkspaceMemberRowSerializer, WorkspaceInviteRowSerializer], None
            ),
            409: ErrorCodeSerializer,
        },
    )
    def post(self, request, slug):
        data = _validated(InviteSerializer, request.data)
        email, role = data["email"], data["role"]
        workspace = self.get_workspace()
        projects = _workspace_projects(workspace, data["project_ids"])

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
                membership = _add_to_workspace(request, workspace, user, role)
                _grant_projects(workspace, projects, role, user=user)
                return Response(_member_row(request, workspace, membership, projects), status=status.HTTP_201_CREATED)

            invite = _invite_email(request, workspace, email, role)
            _grant_projects(workspace, projects, role, email=email)
        data = WorkspaceInviteRowSerializer(invite, context={"projects": {invite.email: projects}}).data
        return Response(data, status=status.HTTP_201_CREATED)


class WorkspaceUserDetailView(WorkspaceContextMixin, SummonAPIView):
    summon_tool = "none"  # access changes stay with people, never AI tools
    permission_classes = [require_capability("users.manage")]

    @extend_schema(
        description="Change a member's workspace role or project access.",
        request=MemberUpdateSerializer,
        responses={200: WorkspaceMemberRowSerializer, 404: ErrorCodeSerializer, 409: ErrorCodeSerializer},
    )
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

        projects = _projects_by_person(workspace).get(target.member_id, [])
        return Response(_member_row(request, workspace, target, projects))


class WorkspaceInviteDetailView(WorkspaceContextMixin, SummonAPIView):
    summon_tool = "none"  # access changes stay with people, never AI tools
    permission_classes = [require_capability("users.manage")]

    @extend_schema(description="Cancel a pending workspace invite.", responses={204: None, 404: ErrorCodeSerializer})
    def delete(self, request, slug, pk):
        workspace = self.get_workspace()
        invite = WorkspaceMemberInvite.objects.filter(workspace=workspace, pk=pk).first()
        if invite is None:
            return Response({"error_code": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        with transaction.atomic():
            invite.delete()
            ProjectMemberInvite.objects.filter(workspace=workspace, email=invite.email).delete()
            _record(request, workspace, Kind.INVITE_REVOKED, invite.email, from_role=invite.role)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectContextMixin:
    def get_project(self, project_id):
        return get_object_or_404(
            Project.objects.select_related("workspace"),
            id=project_id,
            workspace__slug=self.kwargs["slug"],
            workspace__deleted_at__isnull=True,
            archived_at__isnull=True,
        )


class ProjectPeopleView(ProjectContextMixin, SummonAPIView):
    """Who is on one project and who is waiting to join it; adds a workspace member or invites a guest.

    Project admins add people already in the workspace. Bringing in someone new also grants
    workspace access, so that takes `users.manage`.
    """

    summon_tool = {"POST": "none"}  # access changes stay with people, never AI tools
    permission_classes = [require_capability("workspace.view", "workspace.edit")]

    @extend_schema(
        summary="List project members",
        description="Members of one project and the people invited to it.",
        responses={200: ProjectPeopleSerializer, 404: ErrorCodeSerializer},
    )
    def get(self, request, slug, project_id):
        project = self.get_project(project_id)
        if not (_is_project_member(request.user, project) or has_capability(request.user, slug, "users.view")):
            return Response({"error_code": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(_project_people(project).data)

    @extend_schema(
        description="Add a workspace member to a project, or invite a guest to it by email.",
        request=ProjectPersonSerializer,
        responses={
            201: ProjectPeopleSerializer,
            400: ErrorCodeSerializer,
            403: ErrorCodeSerializer,
            409: ErrorCodeSerializer,
        },
    )
    def post(self, request, slug, project_id):
        data = _validated(ProjectPersonSerializer, request.data)
        project = self.get_project(project_id)
        workspace = project.workspace

        if "member_id" in data:
            if not _manages_project(request.user, slug, project):
                return Response({"error_code": "not_project_admin"}, status=status.HTTP_403_FORBIDDEN)
            membership = (
                WorkspaceMember.objects.filter(workspace=workspace, member_id=data["member_id"], is_active=True)
                .select_related("member")
                .first()
            )
            if membership is None:
                return Response({"error_code": "not_workspace_member"}, status=status.HTTP_400_BAD_REQUEST)
            with transaction.atomic():
                _grant_projects(workspace, [project], membership.role, user=membership.member)
            return Response(_project_people(project).data, status=status.HTTP_201_CREATED)

        if not has_capability(request.user, slug, "users.manage"):
            return Response({"error_code": "cannot_invite"}, status=status.HTTP_403_FORBIDDEN)
        email = data["email"]
        with transaction.atomic():
            user = User.objects.filter(email=email).first()
            membership = user and WorkspaceMember.objects.filter(workspace=workspace, member=user).first()
            if membership and not membership.is_active:
                return Response({"error_code": "deactivated_member"}, status=status.HTTP_409_CONFLICT)
            if user:
                membership = membership or _add_to_workspace(request, workspace, user, GUEST)
                _grant_projects(workspace, [project], membership.role, user=user)
            else:
                invite = WorkspaceMemberInvite.objects.filter(
                    workspace=workspace, email=email
                ).first() or _invite_email(request, workspace, email, GUEST)
                _grant_projects(workspace, [project], invite.role, email=email)
        return Response(_project_people(project).data, status=status.HTTP_201_CREATED)


class ProjectInviteDetailView(ProjectContextMixin, SummonAPIView):
    summon_tool = "none"  # access changes stay with people, never AI tools
    permission_classes = [require_capability("workspace.view", "workspace.edit")]

    @extend_schema(description="Cancel a pending project invite.", responses={204: None, 403: ErrorCodeSerializer})
    def delete(self, request, slug, project_id, pk):
        project = self.get_project(project_id)
        if not _manages_project(request.user, slug, project):
            return Response({"error_code": "not_project_admin"}, status=status.HTTP_403_FORBIDDEN)
        ProjectMemberInvite.objects.filter(project=project, pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkspaceAccessHistoryView(WorkspaceContextMixin, SummonAPIView):
    permission_classes = [require_capability("users.view")]

    @extend_schema(
        summary="Workspace access history",
        description="Recent access changes in this workspace: invites, role changes and removals.",
        responses={200: AccessEventSerializer(many=True)},
    )
    def get(self, request, slug):
        events = SummonAccessEvent.objects.filter(workspace=self.get_workspace()).select_related("actor")[:100]
        return Response(AccessEventSerializer(events, many=True).data)


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


def _member_row(request, workspace, membership, projects):
    context = {"workspace": workspace, "viewer": request.user, "projects": {membership.member_id: projects}}
    return WorkspaceMemberRowSerializer(membership, context=context).data


def _add_to_workspace(request, workspace, user, role):
    membership = WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
    _record(request, workspace, Kind.ADDED, user.email, user=user, to_role=role)
    return membership


def _invite_email(request, workspace, email, role):
    # accepted=True lets Plane's sign-in flow both admit the new email past the signup
    # gate and join it to this workspace on first Google sign-in.
    invite = WorkspaceMemberInvite.objects.create(
        workspace=workspace, email=email, role=role, accepted=True, token=secrets.token_urlsafe(32)
    )
    _record(request, workspace, Kind.INVITED, email, to_role=role)
    return invite


def _workspace_projects(workspace, project_ids):
    projects = list(Project.objects.filter(workspace=workspace, id__in=project_ids, archived_at__isnull=True))
    if len(projects) != len(set(project_ids)):
        raise serializers.ValidationError({"project_ids": "Pick active projects in this workspace."})
    return projects


def _grant_projects(workspace, projects, role, user=None, email=None):
    """Put `user` on each project now, or hold a place for `email` until its first sign-in."""
    for project in projects:
        if user is None:
            ProjectMemberInvite.objects.update_or_create(
                workspace=workspace,
                project=project,
                email=email,
                defaults={"role": role, "accepted": True, "token": secrets.token_urlsafe(32)},
            )
            continue
        member = ProjectMember.objects.filter(project=project, member=user).first()
        if member is None:
            ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=role)
        elif not member.is_active or member.role != role:
            member.is_active, member.role = True, role
            member.save(update_fields=["is_active", "role", "updated_at"])


def _is_project_member(user, project, role=None):
    members = ProjectMember.objects.filter(project=project, member=user, is_active=True)
    return (members.filter(role=role) if role else members).exists()


def _manages_project(user, slug, project):
    return has_capability(user, slug, "users.manage") or _is_project_member(user, project, ADMIN)


def _project_people(project):
    members = (
        ProjectMember.objects.filter(project=project, is_active=True, member__is_bot=False)
        .select_related("member")
        .order_by("-role", "member__first_name", "member__email")
    )
    invites = ProjectMemberInvite.objects.filter(project=project).order_by("email")
    return ProjectPeopleSerializer({"members": members, "invites": invites})


def _projects_by_person(workspace):
    """Active projects by member id, and pending projects by invited email, each sorted by name."""
    live = Q(project__archived_at__isnull=True)
    projects = {}
    for row in ProjectMember.objects.filter(live, workspace=workspace, is_active=True).select_related("project"):
        projects.setdefault(row.member_id, []).append(row.project)
    for row in ProjectMemberInvite.objects.filter(live, workspace=workspace).select_related("project"):
        projects.setdefault(row.email, []).append(row.project)
    return {key: sorted(rows, key=lambda p: p.name) for key, rows in projects.items()}
