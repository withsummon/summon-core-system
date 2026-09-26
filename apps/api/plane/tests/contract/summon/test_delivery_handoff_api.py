# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import Project, ProjectMember
from plane.summon.models import Client, Opportunity, SummonProjectProfile
from plane.summon.services.commercial import DeliveryConflict, start_delivery
from plane.tests.contract.summon.test_commercial_api import authenticated_user, create_workspace


def delivery_url(workspace, opportunity):
    return f"/api/summon/workspaces/{workspace.slug}/opportunities/{opportunity.id}/delivery/"


def admin_project(workspace, actor, identifier):
    project = Project.objects.create(workspace=workspace, name=f"Delivery {identifier}", identifier=identifier)
    ProjectMember.objects.create(workspace=workspace, project=project, member=actor, role=20)
    return project


def won_opportunity(workspace, title="Won deal", client=None):
    account = client or Client.objects.create(workspace=workspace, name=f"{title} client")
    return Opportunity.objects.create(workspace=workspace, title=title, stage="won", client=account)


@pytest.mark.django_db
def test_start_delivery_links_existing_project_and_is_visible_from_every_record(workspace):
    actor, api = authenticated_user(workspace, 15)
    project = admin_project(workspace, actor, "DEL")
    opportunity = won_opportunity(workspace)
    project_count = Project.objects.count()

    response = api.post(delivery_url(workspace, opportunity), {"project": str(project.id)}, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert Project.objects.count() == project_count
    profile = SummonProjectProfile.objects.get(project=project)
    assert (profile.client_id, profile.source_opportunity_id) == (opportunity.client_id, opportunity.id)

    detail = api.get(f"/api/summon/workspaces/{workspace.slug}/opportunities/{opportunity.id}/").data
    assert detail["delivery_project"] == {"id": str(project.id), "identifier": "DEL", "name": "Delivery DEL"}
    assert str(detail["project_profile"]["project"]) == str(project.id)
    client_detail = api.get(f"/api/summon/workspaces/{workspace.slug}/clients/{opportunity.client_id}/").data
    assert [item["id"] for item in client_detail["projects"]] == [str(project.id)]
    overview = api.get(f"/api/summon/workspaces/{workspace.slug}/projects/{project.id}/overview/").data
    assert overview["profile"]["source_opportunity"] == str(opportunity.id)


@pytest.mark.django_db
def test_retry_and_double_submit_never_create_a_second_delivery_link(workspace):
    actor, api = authenticated_user(workspace, 15)
    project = admin_project(workspace, actor, "RTY")
    other_project = admin_project(workspace, actor, "OTR")
    opportunity = won_opportunity(workspace)
    url = delivery_url(workspace, opportunity)

    first = api.post(url, {"project": str(project.id)}, format="json")
    retry = api.post(url, {"project": str(project.id)}, format="json")
    second_project = api.post(url, {"project": str(other_project.id)}, format="json")

    assert first.status_code == status.HTTP_201_CREATED
    assert retry.status_code == status.HTTP_200_OK
    assert retry.data["id"] == first.data["id"]
    assert second_project.status_code == status.HTTP_409_CONFLICT
    assert SummonProjectProfile.objects.filter(source_opportunity=opportunity).count() == 1
    assert not SummonProjectProfile.objects.filter(project=other_project).exists()


@pytest.mark.django_db
def test_start_delivery_requires_a_won_client_linked_opportunity(workspace):
    actor, api = authenticated_user(workspace, 15)
    project = admin_project(workspace, actor, "PRE")
    open_deal = Opportunity.objects.create(
        workspace=workspace,
        title="Open deal",
        stage="negotiation",
        client=Client.objects.create(workspace=workspace, name="Acme"),
    )
    clientless = Opportunity.objects.create(workspace=workspace, title="Clientless deal", stage="won")
    removed_client = won_opportunity(workspace, "Removed client deal")
    Client.objects.filter(pk=removed_client.client_id).update(deleted_at=timezone.now())

    not_won = api.post(delivery_url(workspace, open_deal), {"project": str(project.id)}, format="json")
    no_client = api.post(delivery_url(workspace, clientless), {"project": str(project.id)}, format="json")
    deleted_client = api.post(delivery_url(workspace, removed_client), {"project": str(project.id)}, format="json")

    assert not_won.status_code == status.HTTP_400_BAD_REQUEST
    assert "stage" in not_won.data
    assert no_client.status_code == status.HTTP_400_BAD_REQUEST
    assert "client" in no_client.data
    assert deleted_client.status_code == status.HTTP_400_BAD_REQUEST
    assert "client" in deleted_client.data
    assert not SummonProjectProfile.objects.exists()


@pytest.mark.django_db
def test_start_delivery_requires_workspace_write_and_project_admin(workspace):
    member, member_api = authenticated_user(workspace, 15)
    admin, _ = authenticated_user(workspace, 15)
    guest, guest_api = authenticated_user(workspace, 5)
    project = admin_project(workspace, admin, "ADM")
    ProjectMember.objects.create(workspace=workspace, project=project, member=member, role=15)
    ProjectMember.objects.create(workspace=workspace, project=project, member=guest, role=20)
    unjoined = Project.objects.create(workspace=workspace, name="Unjoined", identifier="UNJ")
    opportunity = won_opportunity(workspace)
    url = delivery_url(workspace, opportunity)

    assert member_api.post(url, {"project": str(project.id)}, format="json").status_code == status.HTTP_403_FORBIDDEN
    assert member_api.post(url, {"project": str(unjoined.id)}, format="json").status_code == status.HTTP_403_FORBIDDEN
    assert guest_api.post(url, {"project": str(project.id)}, format="json").status_code == status.HTTP_403_FORBIDDEN
    assert not SummonProjectProfile.objects.exists()


@pytest.mark.django_db
def test_start_delivery_is_workspace_scoped_and_skips_archived_projects(workspace):
    actor, api = authenticated_user(workspace, 20)
    other_owner, _ = authenticated_user()
    other_workspace = create_workspace(other_owner, "other-delivery")
    foreign_project = Project.objects.create(workspace=other_workspace, name="Foreign", identifier="FOR")
    ProjectMember.objects.create(workspace=other_workspace, project=foreign_project, member=actor, role=20)
    foreign_opportunity = won_opportunity(other_workspace, "Foreign deal")
    archived = admin_project(workspace, actor, "ARC")
    Project.objects.filter(pk=archived.pk).update(archived_at=timezone.now())
    project = admin_project(workspace, actor, "OWN")
    opportunity = won_opportunity(workspace)

    wrong_project = api.post(delivery_url(workspace, opportunity), {"project": str(foreign_project.id)}, format="json")
    wrong_opportunity = api.post(
        delivery_url(workspace, foreign_opportunity), {"project": str(project.id)}, format="json"
    )
    archived_project = api.post(delivery_url(workspace, opportunity), {"project": str(archived.id)}, format="json")

    assert wrong_project.status_code == status.HTTP_404_NOT_FOUND
    assert wrong_opportunity.status_code == status.HTTP_404_NOT_FOUND
    assert archived_project.status_code == status.HTTP_404_NOT_FOUND
    assert not SummonProjectProfile.objects.exists()


@pytest.mark.django_db
def test_existing_profile_is_attached_only_when_compatible(workspace):
    actor, api = authenticated_user(workspace, 20)
    opportunity = won_opportunity(workspace)
    compatible = admin_project(workspace, actor, "CMP")
    SummonProjectProfile.objects.create(workspace=workspace, project=compatible, delivery_status="active")
    other_client = admin_project(workspace, actor, "OCL")
    SummonProjectProfile.objects.create(
        workspace=workspace, project=other_client, client=Client.objects.create(workspace=workspace, name="Other")
    )
    other_deal = admin_project(workspace, actor, "ODL")
    SummonProjectProfile.objects.create(
        workspace=workspace,
        project=other_deal,
        client=opportunity.client,
        source_opportunity=won_opportunity(workspace, "Earlier deal", client=opportunity.client),
    )
    url = delivery_url(workspace, opportunity)

    assert api.post(url, {"project": str(other_client.id)}, format="json").status_code == status.HTTP_409_CONFLICT
    assert api.post(url, {"project": str(other_deal.id)}, format="json").status_code == status.HTTP_409_CONFLICT
    attached = api.post(url, {"project": str(compatible.id)}, format="json")

    assert attached.status_code == status.HTTP_200_OK
    profile = SummonProjectProfile.objects.get(project=compatible)
    assert (profile.client_id, profile.source_opportunity_id, profile.delivery_status) == (
        opportunity.client_id,
        opportunity.id,
        "active",
    )


@pytest.mark.django_db
def test_correcting_the_stage_keeps_the_linked_project(workspace):
    actor, api = authenticated_user(workspace, 20)
    project = admin_project(workspace, actor, "KEP")
    opportunity = won_opportunity(workspace)
    api.post(delivery_url(workspace, opportunity), {"project": str(project.id)}, format="json")

    corrected = api.post(
        f"/api/summon/workspaces/{workspace.slug}/opportunities/{opportunity.id}/transitions/",
        {"stage": "negotiation"},
        format="json",
    )

    assert corrected.status_code == status.HTTP_200_OK
    assert Project.objects.filter(pk=project.pk).exists()
    assert SummonProjectProfile.objects.get(project=project).source_opportunity_id == opportunity.id


@pytest.mark.django_db
def test_linked_profile_client_cannot_diverge_and_writes_are_admin_only(workspace):
    actor, api = authenticated_user(workspace, 20)
    member, member_api = authenticated_user(workspace, 15)
    project = admin_project(workspace, actor, "LNK")
    ProjectMember.objects.create(workspace=workspace, project=project, member=member, role=15)
    opportunity = won_opportunity(workspace)
    api.post(delivery_url(workspace, opportunity), {"project": str(project.id)}, format="json")
    url = f"/api/summon/workspaces/{workspace.slug}/projects/{project.id}/profile/"
    other_client = Client.objects.create(workspace=workspace, name="Someone else")

    diverged = api.patch(url, {"client": str(other_client.id)}, format="json")
    unlinked = api.patch(url, {"client": None}, format="json")
    unrelated_edit = api.patch(url, {"phase": "Delivery"}, format="json")

    assert diverged.status_code == status.HTTP_400_BAD_REQUEST
    assert "client" in diverged.data
    assert unlinked.status_code == status.HTTP_400_BAD_REQUEST
    assert unrelated_edit.status_code == status.HTTP_200_OK
    assert member_api.get(url).status_code == status.HTTP_200_OK
    assert member_api.patch(url, {"phase": "Member edit"}, format="json").status_code == status.HTTP_403_FORBIDDEN
    assert SummonProjectProfile.objects.get(project=project).phase == "Delivery"


@pytest.mark.django_db
def test_linked_opportunity_cannot_change_client(workspace):
    actor, api = authenticated_user(workspace, 20)
    project = admin_project(workspace, actor, "IMM")
    opportunity = won_opportunity(workspace)
    original_client = opportunity.client
    other_client = Client.objects.create(workspace=workspace, name="Other account")
    url = f"/api/summon/workspaces/{workspace.slug}/opportunities/{opportunity.id}/"

    before_delivery = api.patch(url, {"client": str(other_client.id)}, format="json")
    assert before_delivery.status_code == status.HTTP_200_OK
    assert (
        api.post(delivery_url(workspace, opportunity), {"project": str(project.id)}, format="json").status_code == 201
    )

    assert api.patch(url, {"client": str(original_client.id)}, format="json").status_code == 400
    assert api.patch(url, {"client": None}, format="json").status_code == 400
    assert api.patch(url, {"client": str(other_client.id)}, format="json").status_code == 200
    opportunity.refresh_from_db()
    profile = SummonProjectProfile.objects.get(project=project)
    assert opportunity.client_id == profile.client_id == other_client.id


@pytest.mark.django_db(transaction=True)
def test_competing_opportunities_for_one_project_return_a_conflict(workspace):
    actor, _ = authenticated_user(workspace, 20)
    project = admin_project(workspace, actor, "RAC")
    first = won_opportunity(workspace, "First won deal")
    second = won_opportunity(workspace, "Second won deal")
    ready = Barrier(2)

    def link(opportunity_id):
        ready.wait(timeout=10)
        try:
            start_delivery(opportunity_id, project, actor)
            return "created"
        except DeliveryConflict:
            return "conflict"

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(link, (first.id, second.id)))

    assert sorted(results) == ["conflict", "created"]
    assert SummonProjectProfile.objects.filter(project=project).count() == 1
