# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import Issue, Project, ProjectMember, State


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
def test_home_summary_excludes_projects_without_membership(session_client, workspace, create_user):
    visible, todo, done = create_project(workspace, create_user, "VIS")
    hidden = Project.objects.create(workspace=workspace, name="Hidden", identifier="HID")
    Issue.objects.create(
        workspace=workspace,
        project=visible,
        state=todo,
        name="Overdue visible issue",
        target_date=timezone.now().date() - timedelta(days=1),
    )
    Issue.objects.create(workspace=workspace, project=visible, state=done, name="Completed visible issue")
    hidden_todo = State.objects.create(
        workspace=workspace,
        project=hidden,
        name="Hidden todo",
        color="#666666",
        group="unstarted",
        default=True,
    )
    Issue.objects.create(workspace=workspace, project=hidden, state=hidden_todo, name="Secret issue")

    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/home/summary/")

    assert response.status_code == status.HTTP_200_OK
    assert [item["id"] for item in response.data["projects"]] == [str(visible.id)]
    assert [item["name"] for item in response.data["priority"]] == ["Overdue visible issue"]
    assert response.data["counts"]["projects"] == 1
    assert response.data["counts"]["issues"] == 2
    assert response.data["counts"]["clients"] == 0
    assert response.data["counts"]["opportunities"] == 0
    assert response.data["recent_activity"] == []
    assert response.data["upcoming_meetings"] == []
    assert response.data["resources"] == []


@pytest.mark.django_db
def test_project_overview_returns_live_project_counts(session_client, workspace, create_user):
    project, todo, done = create_project(workspace, create_user, "OVR")
    Issue.objects.create(
        workspace=workspace,
        project=project,
        state=todo,
        name="Late",
        target_date=timezone.now().date() - timedelta(days=1),
    )
    Issue.objects.create(workspace=workspace, project=project, state=done, name="Completed")

    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/projects/{project.id}/overview/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["project"] == {
        "id": str(project.id),
        "identifier": "OVR",
        "name": "Project OVR",
        "description": "",
    }
    assert response.data["profile"] is None
    assert response.data["progress"] == {"total": 2, "completed": 1, "overdue": 1, "percentage": 50}
    assert [item["name"] for item in response.data["issues"]] == ["Completed", "Late"]
    assert response.data["milestones"] == []
    assert response.data["pages"] == []
    assert response.data["meetings"] == []
    assert response.data["resources"] == []
    assert response.data["activity"] == []


@pytest.mark.django_db
def test_project_overview_rejects_an_inaccessible_project(session_client, workspace):
    hidden = Project.objects.create(workspace=workspace, name="Hidden", identifier="HID")

    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/projects/{hidden.id}/overview/")

    assert response.status_code == status.HTTP_404_NOT_FOUND
