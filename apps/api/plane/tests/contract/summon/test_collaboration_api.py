# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64
from uuid import uuid4

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.bgtasks import copy_s3_object
from plane.db.models import (
    FileAsset,
    Issue,
    Page,
    Project,
    ProjectMember,
    ProjectPage,
    State,
    User,
    Workspace,
    WorkspaceMember,
)
from plane.summon.models import (
    Client,
    Credential,
    Meeting,
    MeetingWorkItem,
    Opportunity,
    ResourceLink,
    SummonPageContext,
)


def authenticated_user(workspace, role=20):
    identity = uuid4().hex
    user = User.objects.create(email=f"collab-{identity}@plane.test", username=f"collab_{identity}")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=role)
    client = APIClient()
    client.force_login(user)
    return user, client


def project_with_member(workspace, member, identifier="COL"):
    project = Project.objects.create(workspace=workspace, name="Collaboration", identifier=identifier)
    ProjectMember.objects.create(workspace=workspace, project=project, member=member, role=20)
    return project


def issue_states(project):
    todo = State.objects.create(
        workspace=project.workspace,
        project=project,
        name="Todo",
        color="#666666",
        group="unstarted",
        default=True,
    )
    done = State.objects.create(
        workspace=project.workspace,
        project=project,
        name="Done",
        color="#00aa00",
        group="completed",
    )
    return todo, done


@pytest.mark.django_db
def test_meeting_crud_uses_plane_assets_and_participants(workspace):
    actor, api = authenticated_user(workspace)
    participant, _ = authenticated_user(workspace, 15)
    project = project_with_member(workspace, actor)
    asset = FileAsset.objects.create(
        workspace=workspace,
        project=project,
        user=actor,
        asset=f"{workspace.id}/recording.mp4",
        attributes={"name": "recording.mp4"},
        is_uploaded=True,
    )
    url = f"/api/summon/workspaces/{workspace.slug}/meetings/"

    response = api.post(
        url,
        {
            "title": "Weekly sync",
            "starts_at": timezone.now().isoformat(),
            "project": str(project.id),
            "recording_asset": str(asset.id),
            "participant_ids": [str(participant.id)],
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["recording_asset_detail"] == {
        "id": str(asset.id),
        "name": "recording.mp4",
        "url": None,
    }
    assert response.data["participants"][0]["member"]["id"] == str(participant.id)
    meeting_id = response.data["id"]
    assert api.patch(f"{url}{meeting_id}/", {"notes": "Decisions"}, format="json").status_code == 200
    assert api.delete(f"{url}{meeting_id}/").status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
def test_meeting_rejects_inaccessible_assets(workspace):
    actor, api = authenticated_user(workspace)
    other_workspace = Workspace.objects.create(name="Other", slug="other-assets", owner=actor)
    asset = FileAsset.objects.create(
        workspace=other_workspace,
        user=actor,
        asset=f"{other_workspace.id}/secret.txt",
        attributes={"name": "secret.txt"},
        is_uploaded=True,
    )

    response = api.post(
        f"/api/summon/workspaces/{workspace.slug}/meetings/",
        {
            "title": "Invalid recording",
            "starts_at": timezone.now().isoformat(),
            "recording_asset": str(asset.id),
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "recording_asset" in response.data


@pytest.mark.django_db
def test_meeting_rejects_foreign_or_nontext_transcript_assets(workspace):
    actor, api = authenticated_user(workspace)
    meeting = Meeting.objects.create(
        workspace=workspace,
        organizer=actor,
        title="Transcript sources",
        starts_at=timezone.now(),
    )
    foreign_workspace = Workspace.objects.create(name="Foreign", slug="foreign-transcript", owner=actor)
    foreign_asset = FileAsset.objects.create(
        workspace=foreign_workspace,
        user=actor,
        asset=f"{foreign_workspace.id}/transcript.txt",
        attributes={"name": "transcript.txt"},
        is_uploaded=True,
    )
    video_asset = FileAsset.objects.create(
        workspace=workspace,
        user=actor,
        asset=f"{workspace.id}/recording.mp4",
        attributes={"name": "recording.mp4"},
        is_uploaded=True,
    )
    url = f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/"

    foreign = api.patch(url, {"transcript_asset": str(foreign_asset.id)}, format="json")
    nontext = api.patch(url, {"transcript_asset": str(video_asset.id)}, format="json")

    assert foreign.status_code == status.HTTP_400_BAD_REQUEST
    assert nontext.status_code == status.HTTP_400_BAD_REQUEST
    assert "transcript_asset" in nontext.data


@pytest.mark.django_db
def test_meeting_persists_plain_transcript_in_a_canonical_page(workspace, monkeypatch):
    actor, api = authenticated_user(workspace)
    project = project_with_member(workspace, actor, "TRANSCRIPT")
    monkeypatch.setattr(
        copy_s3_object,
        "sync_with_external_service",
        lambda _entity, _html: {
            "description_json": {"type": "doc", "content": [{"type": "paragraph"}]},
            "description_binary": base64.b64encode(b"canonical-transcript-page").decode(),
        },
    )
    meeting = Meeting.objects.create(
        workspace=workspace,
        project=project,
        organizer=actor,
        title="Transcript review",
        starts_at=timezone.now(),
    )

    response = api.patch(
        f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/",
        {"transcript": "Decision: ship the review."},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["transcript_text"] == "Decision: ship the review."
    meeting.refresh_from_db()
    assert meeting.summary_page is not None
    assert meeting.summary_page.description_stripped == "Decision: ship the review."
    assert meeting.summary_page.description_binary == b"canonical-transcript-page"
    assert meeting.summary_page.description_json["type"] == "doc"
    assert meeting.summary_page.view_props["summon_document"]["source_transcript"] == ("Decision: ship the review.")
    assert ProjectPage.objects.filter(workspace=workspace, project=project, page=meeting.summary_page).exists()


@pytest.mark.django_db
def test_workspace_meeting_rejects_transcript_page_creation(workspace):
    actor, api = authenticated_user(workspace)
    meeting = Meeting.objects.create(
        workspace=workspace,
        organizer=actor,
        title="Workspace transcript",
        starts_at=timezone.now(),
    )

    response = api.patch(
        f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/",
        {"transcript": "Do not create a workspace Page."},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "project" in response.data
    assert not Page.objects.filter(workspace=workspace, name="Workspace transcript transcript").exists()


@pytest.mark.django_db
def test_meeting_work_item_derives_current_plane_issue_state(workspace):
    actor, api = authenticated_user(workspace)
    project = project_with_member(workspace, actor)
    todo, done = issue_states(project)
    issue = Issue.objects.create(workspace=workspace, project=project, state=todo, name="Send proposal")
    meeting = Meeting.objects.create(
        workspace=workspace,
        project=project,
        organizer=actor,
        title="Sales sync",
        starts_at=timezone.now(),
    )
    url = f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/work-items/"

    linked = api.post(url, {"issue": str(issue.id)}, format="json")
    assert linked.status_code == status.HTTP_201_CREATED
    assert linked.data["issue"]["name"] == "Send proposal"
    assert linked.data["issue"]["completed"] is False

    issue.state = done
    issue.save(update_fields=["state"])
    refreshed = api.get(url)
    assert refreshed.status_code == status.HTTP_200_OK
    assert refreshed.data[0]["issue"]["state"]["group"] == "completed"
    assert refreshed.data[0]["issue"]["completed"] is True
    assert not {"title", "status", "assignee", "due_date"} & {field.name for field in MeetingWorkItem._meta.fields}


@pytest.mark.django_db
def test_linking_issue_requires_active_project_membership(workspace):
    owner, _ = authenticated_user(workspace)
    _, outsider_api = authenticated_user(workspace, 15)
    project = project_with_member(workspace, owner, "SEC")
    todo, _ = issue_states(project)
    issue = Issue.objects.create(workspace=workspace, project=project, state=todo, name="Private issue")
    meeting = Meeting.objects.create(
        workspace=workspace,
        organizer=owner,
        title="Workspace meeting",
        starts_at=timezone.now(),
    )

    response = outsider_api.post(
        f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/work-items/",
        {"issue": str(issue.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "issue" in response.data
    assert not MeetingWorkItem.objects.exists()


@pytest.mark.django_db
def test_page_context_references_plane_records_without_copying_content(workspace):
    actor, api = authenticated_user(workspace)
    project = project_with_member(workspace, actor)
    page = Page.objects.create(
        workspace=workspace,
        owned_by=actor,
        name="Discovery notes",
        description_html="<p>Canonical content</p>",
    )
    client = Client.objects.create(workspace=workspace, name="Acme")
    opportunity = Opportunity.objects.create(workspace=workspace, title="Acme renewal", client=client)
    url = f"/api/summon/workspaces/{workspace.slug}/page-contexts/"

    response = api.post(
        url,
        {
            "page": str(page.id),
            "project": str(project.id),
            "client": str(client.id),
            "opportunity": str(opportunity.id),
            "category": "discovery",
            "tags": ["sales"],
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["page_detail"] == {"id": str(page.id), "name": "Discovery notes"}
    assert "description_html" not in response.data
    assert SummonPageContext.objects.get(page=page).project == project


@pytest.mark.django_db
def test_resources_accept_external_http_urls_only_and_never_files(workspace):
    actor, api = authenticated_user(workspace)
    credential = Credential.objects.create(
        workspace=workspace,
        owner=actor,
        name="GitHub deploy token",
        provider="github",
        secret_ciphertext="encrypted-value",
    )
    url = f"/api/summon/workspaces/{workspace.slug}/resources/"

    created = api.post(
        url,
        {
            "title": "Repository",
            "url": "https://github.com/withsummon/core",
            "category": "repository",
            "credential": str(credential.id),
        },
        format="json",
    )
    assert created.status_code == status.HTTP_201_CREATED
    assert set(created.data) >= {"id", "title", "url", "credential"}
    assert created.data["credential"] == credential.id
    assert not any("secret" in key for key in created.data)
    assert "encrypted-value" not in str(created.data)

    ftp = api.post(url, {"title": "FTP", "url": "ftp://example.com/file"}, format="json")
    assert ftp.status_code == status.HTTP_400_BAD_REQUEST
    assert "url" in ftp.data

    upload = api.post(
        url,
        {
            "title": "Uploaded file",
            "url": "https://example.com/file",
            "file": SimpleUploadedFile("secret.txt", b"secret"),
        },
        format="multipart",
    )
    assert upload.status_code == status.HTTP_400_BAD_REQUEST
    assert "file" in upload.data
    assert ResourceLink.objects.count() == 1
