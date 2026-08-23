# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from uuid import uuid4

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import Project, ProjectMember, User, Workspace, WorkspaceMember
from plane.summon.models import Client, ClientContact, Opportunity, SummonProjectProfile


def authenticated_user(workspace=None, role=None):
    identity = uuid4().hex
    user = User.objects.create(
        email=f"summon-{identity}@plane.test",
        username=f"summon_{identity}",
    )
    if workspace is not None:
        WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
    client = APIClient()
    client.force_login(user)
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
def test_pdf_client_and_opportunity_fields_persist_after_reload(workspace):
    _, api = authenticated_user(workspace, 20)
    clients_url = f"/api/summon/workspaces/{workspace.slug}/clients/"
    client = api.post(
        clients_url,
        {
            "name": "Acme",
            "website": "https://acme.example",
            "head_office": "Jakarta",
            "relationship_started_at": "2024-03-01",
        },
        format="json",
    )

    assert client.status_code == status.HTTP_201_CREATED
    client_detail = api.get(f"{clients_url}{client.data['id']}/")
    assert client_detail.data["website"] == "https://acme.example"
    assert client_detail.data["head_office"] == "Jakarta"
    assert client_detail.data["relationship_started_at"] == "2024-03-01"

    opportunities_url = f"/api/summon/workspaces/{workspace.slug}/opportunities/"
    opportunity = api.post(
        opportunities_url,
        {"title": "Renewal", "product": "Summon Core", "source": "Referral"},
        format="json",
    )
    assert opportunity.status_code == status.HTTP_201_CREATED
    detail = api.get(f"{opportunities_url}{opportunity.data['id']}/")
    assert (detail.data["product"], detail.data["source"]) == ("Summon Core", "Referral")


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
def test_client_detail_contains_only_linked_visible_projects(workspace):
    actor, api = authenticated_user(workspace, 15)
    client = Client.objects.create(workspace=workspace, name="Acme")
    visible = Project.objects.create(workspace=workspace, name="Visible", identifier="VIS")
    hidden = Project.objects.create(workspace=workspace, name="Hidden", identifier="HID")
    ProjectMember.objects.create(workspace=workspace, project=visible, member=actor, role=15)
    SummonProjectProfile.objects.create(workspace=workspace, project=visible, client=client)
    SummonProjectProfile.objects.create(workspace=workspace, project=hidden, client=client)

    response = api.get(f"/api/summon/workspaces/{workspace.slug}/clients/{client.id}/")

    assert response.status_code == status.HTTP_200_OK
    assert [item["id"] for item in response.data["projects"]] == [str(visible.id)]


@pytest.mark.django_db
def test_opportunity_transition_survives_detail_read_back(workspace):
    _, api = authenticated_user(workspace, 15)
    opportunity = Opportunity.objects.create(workspace=workspace, title="Renewal")
    url = f"/api/summon/workspaces/{workspace.slug}/opportunities/{opportunity.id}/transitions/"

    response = api.post(url, {"stage": "proposal", "probability": 60}, format="json")
    detail = api.get(f"/api/summon/workspaces/{workspace.slug}/opportunities/{opportunity.id}/")

    assert response.status_code == status.HTTP_200_OK
    assert (detail.data["stage"], detail.data["probability"]) == ("proposal", 60)


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
    actor, client = authenticated_user(workspace, 20)
    project = Project.objects.create(workspace=workspace, name="Delivery", identifier="DEL")
    ProjectMember.objects.create(workspace=workspace, project=project, member=actor, role=20)
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
    actor, client = authenticated_user(workspace, 20)
    project = Project.objects.create(workspace=workspace, name="Scoped delivery", identifier="SCP")
    ProjectMember.objects.create(workspace=workspace, project=project, member=actor, role=20)
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
    assert wrong_project.status_code == status.HTTP_403_FORBIDDEN

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


@pytest.mark.django_db
def test_project_profile_requires_active_project_membership(workspace):
    actor, client = authenticated_user(workspace, 20)
    project = Project.objects.create(workspace=workspace, name="Private delivery", identifier="PRV")
    url = f"/api/summon/workspaces/{workspace.slug}/projects/{project.id}/profile/"

    assert client.post(url, {}, format="json").status_code == status.HTTP_403_FORBIDDEN

    membership = ProjectMember.objects.create(
        workspace=workspace,
        project=project,
        member=actor,
        role=20,
    )
    assert client.post(url, {}, format="json").status_code == status.HTTP_201_CREATED

    membership.is_active = False
    membership.save(update_fields=["is_active"])
    assert client.get(url).status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_deleted_workspace_cannot_use_commercial_api(workspace):
    _, client = authenticated_user(workspace, 20)
    opportunity = Opportunity.objects.create(workspace=workspace, title="Closing workspace")
    Workspace.objects.filter(pk=workspace.pk).update(deleted_at=timezone.now())

    list_url = f"/api/summon/workspaces/{workspace.slug}/clients/"
    transition_url = f"/api/summon/workspaces/{workspace.slug}/opportunities/{opportunity.id}/transitions/"
    assert client.get(list_url).status_code == status.HTTP_403_FORBIDDEN
    assert client.post(transition_url, {"stage": "won"}, format="json").status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_partial_update_revalidates_existing_references(workspace):
    _, client = authenticated_user(workspace, 15)
    owner, _ = authenticated_user(workspace, 15)
    account = Client.objects.create(workspace=workspace, name="Acme", owner=owner)
    opportunity = Opportunity.objects.create(workspace=workspace, title="Acme deal", client=account)

    owner_membership = WorkspaceMember.objects.get(workspace=workspace, member=owner)
    owner_membership.is_active = False
    owner_membership.save(update_fields=["is_active"])
    client_response = client.patch(
        f"/api/summon/workspaces/{workspace.slug}/clients/{account.id}/",
        {"description": "Updated"},
        format="json",
    )
    assert client_response.status_code == status.HTTP_400_BAD_REQUEST
    assert "owner" in client_response.data

    Client.objects.filter(pk=account.pk).update(deleted_at=timezone.now())
    opportunity_response = client.patch(
        f"/api/summon/workspaces/{workspace.slug}/opportunities/{opportunity.id}/",
        {"description": "Updated"},
        format="json",
    )
    assert opportunity_response.status_code == status.HTTP_400_BAD_REQUEST
    assert "client" in opportunity_response.data
