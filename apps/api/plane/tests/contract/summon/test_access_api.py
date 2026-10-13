# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import Project, ProjectMember, User, WorkspaceMember, WorkspaceMemberInvite
from plane.summon.access import ADMIN, GUEST, MEMBER
from plane.summon.models import SummonAccessEvent


def users_url(workspace, suffix=""):
    return f"/api/summon/workspaces/{workspace.slug}/settings/users/{suffix}"


def add_member(workspace, email, role):
    user = User.objects.create(email=email, username=email.split("@")[0])
    return WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_access_me_returns_role_and_capabilities(session_client, workspace):
    member = add_member(workspace, "member@summon.test", MEMBER)

    admin = session_client.get(f"/api/summon/workspaces/{workspace.slug}/access/me/")
    guest_view = client_for(member.member).get(f"/api/summon/workspaces/{workspace.slug}/access/me/")

    assert admin.data["role_label"] == "Admin"
    assert "users.manage" in admin.data["capabilities"]
    assert guest_view.data["role"] == MEMBER
    assert "users.view" not in guest_view.data["capabilities"]


@pytest.mark.django_db
def test_members_cannot_read_or_manage_users(workspace):
    member = add_member(workspace, "member@summon.test", MEMBER)
    client = client_for(member.member)

    assert client.get(users_url(workspace)).status_code == status.HTTP_403_FORBIDDEN
    response = client.post(users_url(workspace), {"email": "x@summon.test", "role": ADMIN}, format="json")
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_inviting_a_new_email_creates_an_accepted_invite_and_history(session_client, workspace):
    response = session_client.post(users_url(workspace), {"email": " New@Summon.test ", "role": MEMBER}, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    invite = WorkspaceMemberInvite.objects.get(workspace=workspace)
    assert (invite.email, invite.role, invite.accepted) == ("new@summon.test", MEMBER, True)
    event = SummonAccessEvent.objects.get(workspace=workspace)
    assert (event.kind, event.target_email, event.to_role) == ("invited", "new@summon.test", MEMBER)

    again = session_client.post(users_url(workspace), {"email": "new@summon.test", "role": GUEST}, format="json")
    assert again.data["error_code"] == "already_invited"


@pytest.mark.django_db
def test_inviting_an_existing_account_adds_them_now(session_client, workspace):
    user = User.objects.create(email="known@summon.test", username="known")

    response = session_client.post(users_url(workspace), {"email": user.email, "role": GUEST}, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert WorkspaceMember.objects.get(workspace=workspace, member=user).role == GUEST
    assert not WorkspaceMemberInvite.objects.filter(workspace=workspace).exists()


@pytest.mark.django_db
def test_admin_cannot_change_their_own_access(session_client, workspace, create_user):
    own = WorkspaceMember.objects.get(workspace=workspace, member=create_user)

    response = session_client.patch(users_url(workspace, f"{own.id}/"), {"role": MEMBER}, format="json")

    assert response.data["error_code"] == "cannot_change_self"


@pytest.mark.django_db
def test_workspace_owner_keeps_admin(workspace):
    other_admin = add_member(workspace, "admin2@summon.test", ADMIN)
    owner = WorkspaceMember.objects.get(workspace=workspace, member=workspace.owner)

    response = client_for(other_admin.member).patch(
        users_url(workspace, f"{owner.id}/"), {"is_active": False}, format="json"
    )

    assert response.data["error_code"] == "workspace_owner"


@pytest.mark.django_db
def test_demoted_admin_can_no_longer_change_others(session_client, workspace):
    other_admin = add_member(workspace, "admin2@summon.test", ADMIN)
    member = add_member(workspace, "member@summon.test", MEMBER)
    session_client.patch(users_url(workspace, f"{other_admin.id}/"), {"role": MEMBER}, format="json")

    response = client_for(other_admin.member).patch(
        users_url(workspace, f"{member.id}/"), {"role": ADMIN}, format="json"
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_guest_demotion_downgrades_project_roles(session_client, workspace):
    target = add_member(workspace, "member@summon.test", MEMBER)
    project = Project.objects.create(name="Delivery", identifier="DEL", workspace=workspace)
    ProjectMember.objects.create(project=project, workspace=workspace, member=target.member, role=MEMBER)

    response = session_client.patch(users_url(workspace, f"{target.id}/"), {"role": GUEST}, format="json")

    assert response.data["role"] == GUEST
    assert ProjectMember.objects.get(project=project, member=target.member).role == GUEST
    event = SummonAccessEvent.objects.get(kind="role_changed")
    assert (event.from_role, event.to_role) == (MEMBER, GUEST)


@pytest.mark.django_db
def test_deactivate_revokes_projects_and_restore_keeps_them_revoked(session_client, workspace):
    target = add_member(workspace, "member@summon.test", MEMBER)
    project = Project.objects.create(name="Delivery", identifier="DEL", workspace=workspace)
    ProjectMember.objects.create(project=project, workspace=workspace, member=target.member, role=MEMBER)

    off = session_client.patch(users_url(workspace, f"{target.id}/"), {"is_active": False}, format="json")
    on = session_client.patch(users_url(workspace, f"{target.id}/"), {"is_active": True}, format="json")

    assert off.data["is_active"] is False
    assert on.data["is_active"] is True
    assert ProjectMember.objects.get(project=project, member=target.member).is_active is False
    kinds = list(SummonAccessEvent.objects.order_by("created_at").values_list("kind", flat=True))
    assert kinds == ["deactivated", "restored"]


@pytest.mark.django_db
def test_sole_project_admin_cannot_be_deactivated(session_client, workspace):
    target = add_member(workspace, "lead@summon.test", ADMIN)
    project = Project.objects.create(name="Delivery", identifier="DEL", workspace=workspace)
    ProjectMember.objects.create(project=project, workspace=workspace, member=target.member, role=ADMIN)

    response = session_client.patch(users_url(workspace, f"{target.id}/"), {"is_active": False}, format="json")

    assert response.data["error_code"] == "sole_project_admin"
    target.refresh_from_db()
    assert target.is_active is True


@pytest.mark.django_db
def test_revoking_an_invite_records_history(session_client, workspace):
    invite = session_client.post(users_url(workspace), {"email": "new@summon.test", "role": MEMBER}, format="json")

    response = session_client.delete(users_url(workspace, f"invites/{invite.data['id']}/"))

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert not WorkspaceMemberInvite.objects.filter(workspace=workspace).exists()
    history = session_client.get(users_url(workspace, "history/")).data
    assert [e["kind"] for e in history] == ["invite_revoked", "invited"]


@pytest.mark.django_db
def test_access_events_are_immutable(session_client, workspace):
    session_client.post(users_url(workspace), {"email": "new@summon.test", "role": MEMBER}, format="json")
    event = SummonAccessEvent.objects.get()

    event.to_role = ADMIN
    with pytest.raises(ValidationError):
        event.save()
    with pytest.raises(ValidationError):
        event.delete()
