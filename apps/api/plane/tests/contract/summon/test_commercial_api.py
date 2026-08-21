# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from uuid import uuid4

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import APIToken, Project, User, Workspace, WorkspaceMember
from plane.summon.models import Client, ClientContact, Opportunity, SummonProjectProfile


def authenticated_user(workspace=None, role=None):
    identity = uuid4().hex
    user = User.objects.create(
        email=f"summon-{identity}@plane.test",
        username=f"summon_{identity}",
    )
    if workspace is not None:
        WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
    token = APIToken.objects.create(user=user)
    client = APIClient()
    client.credentials(HTTP_X_API_KEY=token.token)
    return user, client


def create_workspace(owner, slug):
    return Workspace.objects.create(name=slug.title(), owner=owner, slug=slug)


@pytest.mark.django_db
def test_workspace_membership_and_role_boundary(workspace):
    admin, admin_client = authenticated_user(workspace, 20)
    member, member_client = authenticated_user(workspace, 15)
    _, guest_client = authenticated_user(workspace, 5)
    _, outsider_client = authenticated_user()
    url = f"/api/summon/workspaces/{workspace.slug}/clients/"

    created = admin_client.post(url, {"name": "Acme", "owner": str(admin.id)}, format="json")
    assert created.status_code == status.HTTP_201_CREATED

    updated = member_client.patch(
        f"{url}{created.data['id']}/",
        {"owner": str(member.id), "status": "active"},
        format="json",
    )
    assert updated.status_code == status.HTTP_200_OK
    assert updated.data["status"] == "active"

    assert guest_client.get(url).status_code == status.HTTP_200_OK
    assert guest_client.post(url, {"name": "Denied"}, format="json").status_code == status.HTTP_403_FORBIDDEN
    assert outsider_client.get(url).status_code == status.HTTP_403_FORBIDDEN
    assert APIClient().get(url).status_code in {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN}


@pytest.mark.django_db
def test_client_queryset_and_references_are_workspace_scoped(workspace):
    member, client = authenticated_user(workspace, 15)
    other_owner, _ = authenticated_user()
    other_workspace = create_workspace(other_owner, "other-commercial")
    WorkspaceMember.objects.create(workspace=other_workspace, member=other_owner, role=20)
    own_client = Client.objects.create(workspace=workspace, name="Visible")
    other_client = Client.objects.create(workspace=other_workspace, name="Hidden")
    url = f"/api/summon/workspaces/{workspace.slug}/clients/"

    response = client.get(url)
    assert response.status_code == status.HTTP_200_OK
    assert [str(item["id"]) for item in response.data] == [str(own_client.id)]
    assert client.get(f"{url}{other_client.id}/").status_code == status.HTTP_404_NOT_FOUND

    invalid_owner = client.post(url, {"name": "Wrong owner", "owner": str(other_owner.id)}, format="json")
    assert invalid_owner.status_code == status.HTTP_400_BAD_REQUEST
    assert "owner" in invalid_owner.data

    deleted = client.delete(f"{url}{own_client.id}/")
    assert deleted.status_code == status.HTTP_204_NO_CONTENT
    assert client.get(f"{url}{own_client.id}/").status_code == status.HTTP_404_NOT_FOUND
    recreated = client.post(url, {"name": "Visible", "owner": str(member.id)}, format="json")
    assert recreated.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
def test_client_contacts_are_nested_crud_and_workspace_scoped(workspace):
    _, api = authenticated_user(workspace, 15)
    parent = Client.objects.create(workspace=workspace, name="Acme")
    other_owner, _ = authenticated_user()
    other_workspace = create_workspace(other_owner, "other-contacts")
    other_parent = Client.objects.create(workspace=other_workspace, name="Other Acme")
    contacts_url = f"/api/summon/workspaces/{workspace.slug}/clients/{parent.id}/contacts/"

    created = api.post(
        contacts_url,
        {"name": "Raya", "email": "raya@example.com", "is_primary": True},
        format="json",
    )
    assert created.status_code == status.HTTP_201_CREATED
    contact_id = created.data["id"]
    assert str(created.data["client"]) == str(parent.id)
    assert [item["id"] for item in api.get(contacts_url).data] == [contact_id]

    updated = api.patch(
        f"{contacts_url}{contact_id}/",
        {"title": "Director"},
        format="json",
    )
    assert updated.status_code == status.HTTP_200_OK
    assert updated.data["title"] == "Director"
    assert api.delete(f"{contacts_url}{contact_id}/").status_code == status.HTTP_204_NO_CONTENT
    assert not ClientContact.objects.filter(pk=contact_id).exists()

    cross_workspace_url = f"/api/summon/workspaces/{workspace.slug}/clients/{other_parent.id}/contacts/"
    assert api.get(cross_workspace_url).status_code == status.HTTP_404_NOT_FOUND
    assert api.post(cross_workspace_url, {"name": "Denied"}, format="json").status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_opportunity_rejects_cross_workspace_client_and_owner(workspace):
    _, client = authenticated_user(workspace, 15)
    other_owner, _ = authenticated_user()
    other_workspace = create_workspace(other_owner, "other-opportunity")
    WorkspaceMember.objects.create(workspace=other_workspace, member=other_owner, role=20)
    other_client = Client.objects.create(workspace=other_workspace, name="Other client")
    url = f"/api/summon/workspaces/{workspace.slug}/opportunities/"

    response = client.post(
        url,
        {
            "title": "Wrong references",
            "client": str(other_client.id),
            "owner": str(other_owner.id),
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert {"client", "owner"}.issubset(response.data)
    assert not Opportunity.objects.filter(title="Wrong references").exists()


@pytest.mark.django_db
def test_transition_changes_probability_only_when_explicitly_provided(workspace):
    actor, client = authenticated_user(workspace, 15)
    opportunity = Opportunity.objects.create(
        workspace=workspace,
        title="Qualified deal",
        stage="lead",
        probability=25,
    )
    url = f"/api/summon/workspaces/{workspace.slug}/opportunities/{opportunity.id}/transitions/"

    response = client.post(url, {"stage": "qualified"}, format="json")
    assert response.status_code == status.HTTP_200_OK
    opportunity.refresh_from_db()
    assert (opportunity.stage, opportunity.probability, opportunity.updated_by) == ("qualified", 25, actor)

    response = client.post(url, {"stage": "proposal", "probability": 60}, format="json")
    assert response.status_code == status.HTTP_200_OK
    opportunity.refresh_from_db()
    assert (opportunity.stage, opportunity.probability) == ("proposal", 60)


@pytest.mark.django_db
def test_transition_cannot_target_another_workspace_opportunity(workspace):
    _, client = authenticated_user(workspace, 20)
    other_owner, _ = authenticated_user()
    other_workspace = create_workspace(other_owner, "other-transition")
    other_opportunity = Opportunity.objects.create(workspace=other_workspace, title="Hidden deal")

    response = client.post(
        f"/api/summon/workspaces/{workspace.slug}/opportunities/{other_opportunity.id}/transitions/",
        {"stage": "won"},
        format="json",
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    other_opportunity.refresh_from_db()
    assert other_opportunity.stage == "lead"


@pytest.mark.django_db
def test_conversion_links_existing_project_without_creating_project(workspace):
    _, client = authenticated_user(workspace, 20)
    project = Project.objects.create(workspace=workspace, name="Delivery", identifier="DEL")
    opportunity = Opportunity.objects.create(workspace=workspace, title="Won deal", stage="won")
    project_count = Project.objects.count()
    url = f"/api/summon/workspaces/{workspace.slug}/projects/{project.id}/profile/"

    response = client.post(
        url,
        {
            "source_opportunity": str(opportunity.id),
            "delivery_status": "planning",
            "budget": "125000.00",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert Project.objects.count() == project_count
    profile = SummonProjectProfile.objects.get(project=project)
    assert profile.source_opportunity == opportunity
    assert str(client.get(url).data["project"]) == str(project.id)


@pytest.mark.django_db
def test_project_profile_rejects_cross_workspace_references(workspace):
    _, client = authenticated_user(workspace, 20)
    project = Project.objects.create(workspace=workspace, name="Scoped delivery", identifier="SCP")
    other_owner, _ = authenticated_user()
    other_workspace = create_workspace(other_owner, "other-profile")
    other_project = Project.objects.create(workspace=other_workspace, name="Other delivery", identifier="OTH")
    other_client = Client.objects.create(workspace=other_workspace, name="Other account")
    other_opportunity = Opportunity.objects.create(workspace=other_workspace, title="Other deal")
    project_count = Project.objects.count()

    wrong_project = client.post(
        f"/api/summon/workspaces/{workspace.slug}/projects/{other_project.id}/profile/",
        {},
        format="json",
    )
    assert wrong_project.status_code == status.HTTP_404_NOT_FOUND

    response = client.post(
        f"/api/summon/workspaces/{workspace.slug}/projects/{project.id}/profile/",
        {
            "client": str(other_client.id),
            "source_opportunity": str(other_opportunity.id),
        },
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert {"client", "source_opportunity"}.issubset(response.data)
    assert Project.objects.count() == project_count
    assert not SummonProjectProfile.objects.exists()
