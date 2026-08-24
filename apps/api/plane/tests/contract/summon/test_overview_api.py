# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import FileAsset, Issue, Project, ProjectMember, State
from plane.summon.models import SummonProjectProfile


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
    assert response.data["projects"] == [
        {
            "id": str(visible.id),
            "identifier": visible.identifier,
            "name": visible.name,
            "health": "not_assessed",
            "completion": 50,
        }
    ]
    assert [item["name"] for item in response.data["priority"]] == ["Overdue visible issue"]
    assert response.data["counts"]["projects"] == 1
    assert response.data["counts"]["issues"] == 2
    assert response.data["counts"]["clients"] == 0
    assert response.data["counts"]["opportunities"] == 0
    assert response.data["recent_activity"] == []
    assert response.data["upcoming_meetings"] == []
    assert response.data["resources"] == []


@pytest.mark.django_db
def test_home_summary_excludes_archived_projects(session_client, workspace, create_user):
    visible, _, _ = create_project(workspace, create_user, "LIVE")
    archived, _, _ = create_project(workspace, create_user, "ARCH")
    archived.archived_at = timezone.now()
    archived.save(update_fields=["archived_at"])

    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/home/summary/")

    assert response.status_code == status.HTTP_200_OK
    assert [item["id"] for item in response.data["projects"]] == [str(visible.id)]
    assert response.data["counts"]["projects"] == 1


@pytest.mark.django_db
def test_project_overview_returns_live_project_counts(session_client, workspace, create_user):
    project, todo, done = create_project(workspace, create_user, "OVR")
    late_issue = Issue.objects.create(
        workspace=workspace,
        project=project,
        state=todo,
        name="Late",
        target_date=timezone.now().date() - timedelta(days=1),
    )
    Issue.objects.create(workspace=workspace, project=project, state=done, name="Completed")
    profile = SummonProjectProfile.objects.create(
        workspace=workspace,
        project=project,
        delivery_status=SummonProjectProfile.DeliveryStatus.ACTIVE,
        phase="Delivery",
        health=SummonProjectProfile.ProjectHealth.AT_RISK,
        start_date="2026-08-01",
        target_date="2026-09-30",
        budget="12500000.00",
    )
    attachment = FileAsset.objects.create(
        workspace=workspace,
        project=project,
        issue=late_issue,
        entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
        entity_identifier=str(late_issue.id),
        attributes={"name": "brief.pdf", "type": "application/pdf", "size": 2048},
        asset="workspace/brief.pdf",
        size=2048,
        is_uploaded=True,
    )
    FileAsset.objects.create(
        workspace=workspace,
        project=project,
        entity_type=FileAsset.EntityTypeContext.PROJECT_COVER,
        entity_identifier=str(project.id),
        attributes={"name": "cover.jpg", "type": "image/jpeg", "size": 512},
        asset="workspace/cover.jpg",
        size=512,
        is_uploaded=True,
    )
    hidden_project = Project.objects.create(workspace=workspace, name="Hidden", identifier="HID")
    FileAsset.objects.create(
        workspace=workspace,
        project=hidden_project,
        entity_type=FileAsset.EntityTypeContext.ISSUE_ATTACHMENT,
        entity_identifier=str(hidden_project.id),
        attributes={"name": "secret.pdf", "type": "application/pdf", "size": 1024},
        asset="workspace/secret.pdf",
        size=1024,
        is_uploaded=True,
    )

    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/projects/{project.id}/overview/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["project"] == {
        "id": str(project.id),
        "identifier": "OVR",
        "name": "Project OVR",
        "description": "",
    }
    assert response.data["profile"] == {
        "id": str(profile.id),
        "project": str(project.id),
        "client": None,
        "source_opportunity": None,
        "delivery_status": "active",
        "phase": "Delivery",
        "health": "at_risk",
        "start_date": "2026-08-01",
        "target_date": "2026-09-30",
        "budget": "12500000.00",
    }
    assert response.data["progress"] == {"total": 2, "completed": 1, "overdue": 1, "percentage": 50}
    assert [item["name"] for item in response.data["issues"]] == ["Completed", "Late"]
    assert response.data["milestones"] == []
    assert response.data["pages"] == []
    assert response.data["meetings"] == []
    assert response.data["resources"] == []
    assert response.data["activity"] == []
    assert response.data["files"] == [
        {
            "id": str(attachment.id),
            "name": "brief.pdf",
            "content_type": "application/pdf",
            "size": 2048,
            "entity_type": "ISSUE_ATTACHMENT",
            "url": attachment.asset_url,
            "created_at": attachment.created_at.isoformat().replace("+00:00", "Z"),
        }
    ]


@pytest.mark.django_db
def test_project_overview_rejects_an_inaccessible_project(session_client, workspace):
    hidden = Project.objects.create(workspace=workspace, name="Hidden", identifier="HID")

    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/projects/{hidden.id}/overview/")

    assert response.status_code == status.HTTP_404_NOT_FOUND
