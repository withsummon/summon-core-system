# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import Issue, Project, ProjectMember, State
from plane.summon.models import Client, GeneratedArtifact, Opportunity


def create_project(workspace, member, identifier):
    project = Project.objects.create(workspace=workspace, name=f"Project {identifier}", identifier=identifier)
    ProjectMember.objects.create(workspace=workspace, project=project, member=member, role=20)
    todo = State.objects.create(
        workspace=workspace,
        project=project,
        name=f"Todo {identifier}",
        color="#666666",
        group="unstarted",
        default=True,
    )
    done = State.objects.create(
        workspace=workspace,
        project=project,
        name=f"Done {identifier}",
        color="#00aa00",
        group="completed",
    )
    return project, todo, done


@pytest.mark.django_db
def test_default_automation_templates_are_available(session_client, workspace):
    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/automation/templates/")

    assert response.status_code == status.HTTP_200_OK
    assert {item["type"] for item in response.data} == {
        "proposal",
        "quotation",
        "mom",
        "presentation_outline",
        "cost_projection",
        "poc_brief",
    }


@pytest.mark.django_db
def test_automation_is_synchronous_deterministic_and_targets_plane_page(session_client, workspace, create_user):
    project, _, _ = create_project(workspace, create_user, "AUTO")
    templates_url = f"/api/summon/workspaces/{workspace.slug}/automation/templates/"
    template = next(item for item in session_client.get(templates_url).data if item["type"] == "proposal")
    jobs_url = f"/api/summon/workspaces/{workspace.slug}/automation/jobs/"
    payload = {
        "template": template["id"],
        "project": str(project.id),
        "input": {"client": "Acme", "scope": "Plane migration", "title": "Acme Proposal"},
    }

    first = session_client.post(jobs_url, payload, format="json")
    second = session_client.post(jobs_url, payload, format="json")

    assert first.status_code == second.status_code == status.HTTP_201_CREATED
    assert first.data["status"] == second.data["status"] == "completed"
    assert (
        first.data["artifacts"][0]["page_detail"]["markdown"] == second.data["artifacts"][0]["page_detail"]["markdown"]
    )
    artifacts = GeneratedArtifact.objects.filter(job_id__in=[first.data["id"], second.data["id"]])
    assert artifacts.count() == 2
    assert all(bool(item.page_id) ^ bool(item.file_asset_id) for item in artifacts)


@pytest.mark.django_db
def test_report_totals_match_canonical_queries(session_client, workspace, create_user):
    project, todo, done = create_project(workspace, create_user, "RPT")
    Issue.objects.create(
        workspace=workspace,
        project=project,
        state=todo,
        name="Late",
        target_date=timezone.now().date() - timedelta(days=1),
    )
    Issue.objects.create(workspace=workspace, project=project, state=done, name="Complete")
    client = Client.objects.create(workspace=workspace, name="Acme")
    Opportunity.objects.create(workspace=workspace, client=client, title="Renewal", stage="qualified", value="500.00")

    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/reports/summary/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["projects"] == Project.objects.filter(project_projectmember__member=create_user).count()
    assert response.data["issues"]["total"] == Issue.objects.filter(project=project).count()
    assert response.data["issues"]["completed"] == 1
    assert response.data["issues"]["overdue"] == 1
    assert response.data["commercial"]["clients"] == 1
    assert response.data["commercial"]["pipeline_value"] == "500.00"


@pytest.mark.django_db
def test_assistant_never_returns_unauthorized_project_data(session_client, workspace, create_user):
    visible, visible_todo, _ = create_project(workspace, create_user, "VIS")
    hidden = Project.objects.create(workspace=workspace, name="Hidden Project", identifier="HID")
    hidden_todo = State.objects.create(
        workspace=workspace,
        project=hidden,
        name="Hidden todo",
        color="#666666",
        group="unstarted",
        default=True,
    )
    overdue = timezone.now().date() - timedelta(days=1)
    Issue.objects.create(
        workspace=workspace, project=visible, state=visible_todo, name="Visible overdue", target_date=overdue
    )
    Issue.objects.create(workspace=workspace, project=hidden, state=hidden_todo, name="TOP SECRET", target_date=overdue)
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/query/"

    response = session_client.post(url, {"intent": "overdue_work_items"}, format="json")
    unsupported = session_client.post(url, {"intent": "write_fiction"}, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert "Visible overdue" in str(response.data)
    assert "TOP SECRET" not in str(response.data)
    assert unsupported.data == {
        "intent": "unsupported",
        "answer": "Intent is not supported by Summon Core.",
        "data": [],
    }
