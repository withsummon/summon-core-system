# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64
from uuid import uuid4

import pytest
from cryptography.fernet import Fernet
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test.utils import CaptureQueriesContext
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
    ClientContact,
    Credential,
    Meeting,
    MeetingParticipant,
    MeetingWorkItem,
    Opportunity,
    ResourceLink,
    SummonPageContext,
    SummonProjectProfile,
)
from plane.summon.services import tldv
from plane.summon.services.credential import encrypt_secret


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
        asset=f"{workspace.id}/recording.m4a",
        attributes={"name": "recording.m4a", "type": "audio/mp4"},
        entity_type=FileAsset.EntityTypeContext.MEETING_RECORDING,
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
        "name": "recording.m4a",
        "url": f"/api/assets/v2/workspaces/{workspace.slug}/{asset.id}/",
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
    sent = []
    monkeypatch.setattr(
        copy_s3_object,
        "sync_with_external_service",
        lambda _entity, html: (
            sent.append(html)
            or {
                "description_json": {"type": "doc", "content": [{"type": "paragraph"}]},
                "description_binary": base64.b64encode(b"canonical-transcript-page").decode(),
            }
        ),
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
    # Live gets one paragraph per line, escaped.
    assert sent == ["<p>Decision: ship the review.</p>"]

    # Whisper-style timestamps become timed segments; untimed lines stay as text.
    timed = api.patch(
        f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/",
        {"transcript": "[00:01:05] Opening & remarks\nUntimed note"},
        format="json",
    )

    assert timed.status_code == status.HTTP_200_OK
    assert sent[-1] == "<p>[00:01:05] Opening &amp; remarks</p><p>Untimed note</p>"
    assert timed.data["transcript_segments"] == [
        {"start": 65.0, "end": None, "speaker": "", "text": "Opening & remarks"},
        {"start": None, "end": None, "speaker": "", "text": "Untimed note"},
    ]
    assert timed.data["external_url"] == ""


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
def test_pages_are_readable_only_where_plane_would_show_them(workspace):
    actor, api = authenticated_user(workspace)
    other, _ = authenticated_user(workspace)
    project = project_with_member(workspace, actor)
    hidden_project = Project.objects.create(workspace=workspace, name="Hidden", identifier="HID")

    def page(name, owner, access=Page.PUBLIC_ACCESS, in_project=None):
        created = Page.objects.create(
            workspace=workspace, owned_by=owner, name=name, access=access, description_html=f"<p>{name} body</p>"
        )
        if in_project:
            ProjectPage.objects.create(workspace=workspace, project=in_project, page=created)
        return created

    notes = page("Kickoff notes", other, in_project=project)
    page("Other project notes", other, in_project=hidden_project)
    private = page("Private draft", other, access=Page.PRIVATE_ACCESS, in_project=project)
    base = f"/api/summon/workspaces/{workspace.slug}/pages/"

    listed = api.get(base)
    assert listed.status_code == status.HTTP_200_OK
    assert [item["name"] for item in listed.data] == ["Kickoff notes"]
    assert listed.data[0]["project_ids"] == [project.id]
    assert listed.data[0]["href"] == f"/{workspace.slug}/projects/{project.id}/pages/{notes.id}/"
    assert api.get(base, {"search": "nothing"}).data == []
    assert api.get(base, {"project_id": "not-a-uuid"}).status_code == status.HTTP_400_BAD_REQUEST

    read = api.get(f"{base}{notes.id}/")
    assert read.status_code == status.HTTP_200_OK
    assert read.data["content"] == "Kickoff notes body"
    assert read.data["truncated"] is False
    assert api.get(f"{base}{private.id}/").status_code == status.HTTP_404_NOT_FOUND


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


@pytest.mark.django_db
def test_meeting_list_query_count_does_not_grow_with_meetings(workspace):
    actor, api = authenticated_user(workspace)
    project = project_with_member(workspace, actor)
    hidden_project = Project.objects.create(workspace=workspace, name="Hidden", identifier="HID")
    todo, _ = issue_states(project)
    hidden_todo, _ = issue_states(hidden_project)
    author, _ = authenticated_user(workspace)
    url = f"/api/summon/workspaces/{workspace.slug}/meetings/"

    def add_meeting(title, summary_project):
        meeting = Meeting.objects.create(
            workspace=workspace, project=project, organizer=actor, title=title, starts_at=timezone.now()
        )
        # Someone else's summary page: the actor reads it only through membership of the page's project.
        meeting.summary_page = Page.objects.create(
            workspace=workspace,
            owned_by=author,
            name=f"{title} summary",
            view_props={"summon_summary_meeting_id": str(meeting.id)},
        )
        meeting.save(update_fields=["summary_page"])
        ProjectPage.objects.create(workspace=workspace, project=summary_project, page=meeting.summary_page)
        MeetingParticipant.objects.create(workspace=workspace, meeting=meeting, member=actor)
        visible = Issue.objects.create(workspace=workspace, project=project, state=todo, name=f"{title} visible")
        deleted = Issue.objects.create(workspace=workspace, project=project, state=todo, name=f"{title} deleted")
        hidden = Issue.objects.create(
            workspace=workspace, project=hidden_project, state=hidden_todo, name=f"{title} hidden"
        )
        for issue in (visible, deleted, hidden):
            MeetingWorkItem.objects.create(workspace=workspace, meeting=meeting, issue=issue)
        deleted.delete()

    def list_meetings():
        with CaptureQueriesContext(connection) as queries:
            response = api.get(url)
        assert response.status_code == status.HTTP_200_OK
        return response, len(queries)

    add_meeting("First", project)
    _, single = list_meetings()
    for index in range(2):
        add_meeting(f"Extra {index}", project)
    add_meeting("Hidden summary", hidden_project)
    response, many = list_meetings()

    assert many == single
    assert len(response.data) == 4
    for meeting in response.data:
        assert [participant["member"]["id"] for participant in meeting["participants"]] == [str(actor.id)]
        assert [item["issue"]["name"] for item in meeting["work_items"]] == [f"{meeting['title']} visible"]
        summary = meeting["summary_page_detail"]
        if meeting["title"] == "Hidden summary":
            assert summary is None
        else:
            assert summary["name"] == f"{meeting['title']} summary"


TLDV_MEETING = {
    "id": "6acdf591a77a580013b2b38a",
    "name": "POC lanjutan",
    # The REST API's real format: JavaScript Date.toString(), not ISO 8601.
    "happenedAt": "Tue Oct 13 2026 09:10:41 GMT+0000 (Coordinated Universal Time)",
    "duration": 2081,
    "organizer": {"name": "Summon Development", "email": "business@with-summon.com"},
    # Another person at a client contact's company, plus a personal mailbox that names no client.
    "invitees": [{"name": "Budi", "email": "Budi@ish.co.id"}, {"name": "Ayu", "email": "ayu@gmail.com"}],
}
TLDV_NOTES = {"markdownContent": "## 1. Item Tindakan\n\n- [ ] Kirim file sampel [04:35](/app/meetings/x?t=275)"}


class FakeTldvClient:
    def __init__(self, api_key):
        assert api_key == "tldv-key"

    def meetings(self, page):
        return {
            "page": 1,
            "pages": 1,
            "results": [
                TLDV_MEETING,
                # Titles name clients the short way: an acronym, or the name without its legal form.
                {**TLDV_MEETING, "id": "by-acronym", "name": "[Online] Proyek PDF BSB", "invitees": []},
                {**TLDV_MEETING, "id": "by-name", "name": "Meet WBS PLN AI Security", "invitees": []},
                {**TLDV_MEETING, "id": "unmatched", "name": "Weekly sync", "invitees": []},
            ],
        }

    def transcript(self, meeting_id):
        return {
            "data": [
                {"speaker": "Summon Development", "text": "Selamat sore.", "startTime": 217, "endTime": 220},
                {"speaker": "Triana", "text": "Hai, Bu Miska.", "startTime": 235, "endTime": 237},
                {"speaker": "Triana", "text": "  ", "startTime": 238, "endTime": 239},
            ]
        }

    def notes(self, meeting_id):
        return TLDV_NOTES


def client_project(workspace, member, identifier, client_name):
    project = Project.objects.create(workspace=workspace, name=client_name, identifier=identifier)
    ProjectMember.objects.create(workspace=workspace, project=project, member=member, role=20)
    client = Client.objects.create(workspace=workspace, name=client_name)
    SummonProjectProfile.objects.create(workspace=workspace, project=project, client=client)
    return project, client


@pytest.mark.django_db
def test_tldv_import_files_meetings_by_client_and_is_idempotent(workspace, settings, monkeypatch):
    settings.SUMMON_CREDENTIAL_KEY = Fernet.generate_key().decode()
    monkeypatch.setattr(tldv, "TldvClient", FakeTldvClient)
    monkeypatch.setattr(
        copy_s3_object,
        "sync_with_external_service",
        lambda _entity, _html: {
            "description_json": {"type": "doc", "content": [{"type": "paragraph"}]},
            "description_binary": base64.b64encode(b"meeting-page").decode(),
        },
    )
    actor, api = authenticated_user(workspace)
    fallback = project_with_member(workspace, actor, "TLDV")
    talent, ish = client_project(workspace, actor, "TAL", "PT Infomedia Solusi Humanika")
    ClientContact.objects.create(workspace=workspace, client=ish, name="Rina", email="rina@ish.co.id")
    logistics, _ = client_project(workspace, actor, "LOGI", "PT Bangun Semangat Bersama")
    security, _ = client_project(workspace, actor, "SOC", "PT PLN (Persero)")
    credential = Credential.objects.create(
        workspace=workspace, owner=actor, name="tl;dv", provider="github", secret_ciphertext=encrypt_secret("tldv-key")
    )
    url = f"/api/summon/workspaces/{workspace.slug}/meetings/import/tldv/"
    body = {"credential": str(credential.id), "project": str(fallback.id)}

    rejected = api.post(url, body, format="json")
    assert rejected.status_code == status.HTTP_400_BAD_REQUEST
    assert rejected.data["error_code"] == "tldv_credential_required"

    credential.provider = "tldv"
    credential.save(update_fields=["provider"])
    response = api.post(url, body, format="json")

    assert response.status_code == status.HTTP_200_OK, response.data
    assert response.data["remaining"] == 0
    meetings = {meeting["title"]: meeting for meeting in response.data["meetings"]}
    assert {title: str(meeting["project"]) for title, meeting in meetings.items()} == {
        "POC lanjutan": str(talent.id),
        "[Online] Proyek PDF BSB": str(logistics.id),
        "Meet WBS PLN AI Security": str(security.id),
        "Weekly sync": str(fallback.id),
    }
    imported = meetings["POC lanjutan"]
    assert imported["status"] == "completed"
    assert imported["starts_at"].startswith("2026-10-13T09:10:41")
    assert imported["ends_at"].startswith("2026-10-13T09:45:22")
    assert imported["external_url"] == f"https://tldv.io/app/meetings/{TLDV_MEETING['id']}"
    assert imported["notes"] == TLDV_NOTES["markdownContent"]
    # Everyone on the invite is kept, members or not; the organizer comes first.
    assert imported["attendees"] == [
        {"name": "Summon Development", "email": "business@with-summon.com"},
        {"name": "Budi", "email": "budi@ish.co.id"},
        {"name": "Ayu", "email": "ayu@gmail.com"},
    ]
    assert imported["transcript_segments"] == [
        {"start": 217.0, "end": 220.0, "speaker": "Summon Development", "text": "Selamat sore."},
        {"start": 235.0, "end": 237.0, "speaker": "Triana", "text": "Hai, Bu Miska."},
    ]
    assert imported["transcript_text"] == "[03:37] Summon Development: Selamat sore.\n[03:55] Triana: Hai, Bu Miska."

    # A second sync skips meetings it already imported.
    again = api.post(url, body, format="json")
    assert again.data["meetings"] == []
    assert Meeting.objects.filter(workspace=workspace, external_source="tldv").count() == 4

    # Moving a meeting moves its transcript page with it.
    moved = api.patch(
        f"/api/summon/workspaces/{workspace.slug}/meetings/{imported['id']}/",
        {"project": str(logistics.id)},
        format="json",
    )
    assert moved.status_code == status.HTTP_200_OK, moved.data
    page_id = Meeting.objects.get(id=imported["id"]).summary_page_id
    assert list(ProjectPage.objects.filter(page_id=page_id).values_list("project_id", flat=True)) == [logistics.id]


def test_tldv_client_reads_no_content_as_a_missing_transcript():
    class Response:
        def __init__(self, status_code, body=None):
            self.status_code = status_code
            self.body = body

        def json(self):
            if self.body is None:
                raise ValueError("no body")
            return self.body

    responses = {
        "/meetings/a/transcript": Response(204),
        "/meetings/a/notes": Response(200, {"markdownContent": None}),
    }
    client = tldv.TldvClient.__new__(tldv.TldvClient)
    client.session = type(
        "Session", (), {"get": lambda _self, url, **_kw: responses[url.removeprefix(tldv.TLDV_API_URL)]}
    )()

    assert client.transcript("a") is None
    assert client.notes("a") == {"markdownContent": None}
