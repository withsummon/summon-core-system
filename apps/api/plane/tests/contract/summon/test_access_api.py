# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.test import APIClient

from plane.authentication.utils.workspace_project_join import process_workspace_project_invitations
from plane.db.models import (
    Project,
    ProjectMember,
    ProjectMemberInvite,
    User,
    Workspace,
    WorkspaceMember,
    WorkspaceMemberInvite,
)
from plane.summon.access import ADMIN, GUEST, MEMBER
from plane.summon.models import Client, Opportunity, SummonAccessEvent, SummonProjectProfile


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


@pytest.mark.django_db
@pytest.mark.parametrize("role", [MEMBER, GUEST])
def test_only_admins_see_deals_reports_and_money(session_client, workspace, create_user, role):
    user = add_member(workspace, f"role{role}@summon.test", role).member
    project = Project.objects.create(workspace=workspace, name="Delivery", identifier="DLV")
    ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=role)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=ADMIN)
    account = Client.objects.create(workspace=workspace, name="Acme")
    deal = Opportunity.objects.create(workspace=workspace, title="Retainer", client=account, value=5000)
    SummonProjectProfile.objects.create(workspace=workspace, project=project, client=account, budget=5000)
    base = f"/api/summon/workspaces/{workspace.slug}"
    client = client_for(user)

    for url in (f"{base}/opportunities/", f"{base}/opportunities/{deal.id}/", f"{base}/reports/summary/"):
        assert client.get(url).status_code == status.HTTP_403_FORBIDDEN
        assert session_client.get(url).status_code == status.HTTP_200_OK
    assert "opportunities" not in client.get(f"{base}/clients/{account.id}/").data
    assert "opportunities" not in client.get(f"{base}/home/summary/").data["counts"]
    profile = client.get(f"{base}/projects/{project.id}/overview/").data["profile"]
    assert "budget" not in profile and "source_opportunity" not in profile
    pipeline = client.post(f"{base}/assistant/query/", {"intent": "client_opportunity_pipeline"}, format="json")
    assert pipeline.data.get("data", []) == []  # guests cannot post at all

    admin_profile = session_client.get(f"{base}/projects/{project.id}/overview/").data["profile"]
    assert admin_profile["budget"] == "5000.00"


def people_url(workspace, project, suffix=""):
    return f"/api/summon/workspaces/{workspace.slug}/projects/{project.id}/people/{suffix}"


@pytest.mark.django_db
def test_invite_with_projects_waits_for_first_sign_in(session_client, workspace):
    project = Project.objects.create(workspace=workspace, name="Portal", identifier="PRT")

    response = session_client.post(
        users_url(workspace),
        {"email": "client@acme.test", "role": GUEST, "project_ids": [str(project.id)]},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert [p["name"] for p in response.data["projects"]] == ["Portal"]
    pending = ProjectMemberInvite.objects.get(project=project, email="client@acme.test")
    assert (pending.role, pending.accepted) == (GUEST, True)

    user = User.objects.create(email="client@acme.test", username="client")
    process_workspace_project_invitations(user)
    assert ProjectMember.objects.get(project=project, member=user).role == GUEST
    assert WorkspaceMember.objects.get(workspace=workspace, member=user).role == GUEST


@pytest.mark.django_db
def test_invite_existing_account_joins_projects_now_and_lists_them(session_client, workspace):
    project = Project.objects.create(workspace=workspace, name="Portal", identifier="PRT")
    user = User.objects.create(email="known@summon.test", username="known")

    session_client.post(
        users_url(workspace), {"email": user.email, "role": MEMBER, "project_ids": [str(project.id)]}, format="json"
    )

    assert ProjectMember.objects.get(project=project, member=user).role == MEMBER
    listed = next(m for m in session_client.get(users_url(workspace)).data["members"] if m["email"] == user.email)
    assert [p["identifier"] for p in listed["projects"]] == ["PRT"]


@pytest.mark.django_db
def test_invite_rejects_projects_from_another_workspace(session_client, workspace, create_user):
    other = Workspace.objects.create(name="Other", slug="other-ws", owner=create_user)
    foreign = Project.objects.create(workspace=other, name="Foreign", identifier="FRN")

    response = session_client.post(
        users_url(workspace), {"email": "x@summon.test", "role": GUEST, "project_ids": [str(foreign.id)]}, format="json"
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert not WorkspaceMemberInvite.objects.filter(email="x@summon.test").exists()


@pytest.mark.django_db
def test_revoking_an_invite_drops_its_pending_projects(session_client, workspace):
    project = Project.objects.create(workspace=workspace, name="Portal", identifier="PRT")
    invite = session_client.post(
        users_url(workspace), {"email": "c@acme.test", "role": GUEST, "project_ids": [str(project.id)]}, format="json"
    ).data

    session_client.delete(users_url(workspace, f"invites/{invite['id']}/"))

    assert not ProjectMemberInvite.objects.filter(email="c@acme.test").exists()


@pytest.mark.django_db
def test_project_admin_adds_workspace_member_but_cannot_invite_new_people(workspace):
    lead = add_member(workspace, "lead@summon.test", MEMBER).member
    teammate = add_member(workspace, "mate@summon.test", MEMBER).member
    project = Project.objects.create(workspace=workspace, name="Portal", identifier="PRT")
    ProjectMember.objects.create(workspace=workspace, project=project, member=lead, role=ADMIN)
    client = client_for(lead)

    added = client.post(people_url(workspace, project), {"member_id": str(teammate.id)}, format="json")
    invited = client.post(people_url(workspace, project), {"email": "new@acme.test"}, format="json")

    assert added.status_code == status.HTTP_201_CREATED
    assert {m["email"]: m["role"] for m in added.data["members"]}["mate@summon.test"] == MEMBER
    assert invited.status_code == status.HTTP_403_FORBIDDEN
    assert not WorkspaceMemberInvite.objects.filter(email="new@acme.test").exists()


@pytest.mark.django_db
def test_admin_invites_new_email_to_one_project_as_guest(session_client, workspace):
    project = Project.objects.create(workspace=workspace, name="Portal", identifier="PRT")
    outsider = User.objects.create(email="outsider@acme.test", username="outsider")

    new = session_client.post(people_url(workspace, project), {"email": "New@Acme.test"}, format="json")
    existing = session_client.post(people_url(workspace, project), {"email": outsider.email}, format="json")

    assert new.status_code == status.HTTP_201_CREATED
    assert WorkspaceMemberInvite.objects.get(workspace=workspace, email="new@acme.test").role == GUEST
    assert [i["email"] for i in existing.data["invites"]] == ["new@acme.test"]
    assert WorkspaceMember.objects.get(workspace=workspace, member=outsider).role == GUEST
    assert {m["email"]: m["role"] for m in existing.data["members"]}["outsider@acme.test"] == GUEST

    pending = existing.data["invites"][0]["id"]
    assert session_client.delete(people_url(workspace, project, f"invites/{pending}/")).status_code == 204
    assert not ProjectMemberInvite.objects.filter(project=project).exists()


@pytest.mark.django_db
def test_project_people_hidden_from_non_members(workspace):
    project = Project.objects.create(workspace=workspace, name="Portal", identifier="PRT")
    stranger = add_member(workspace, "stranger@summon.test", MEMBER).member

    assert client_for(stranger).get(people_url(workspace, project)).status_code == status.HTTP_404_NOT_FOUND
