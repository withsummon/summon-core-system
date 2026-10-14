# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64

import pytest
from cryptography.fernet import Fernet
from rest_framework import status

from plane.bgtasks import copy_s3_object
from plane.db.models import Project, ProjectMember, ProjectPage
from plane.summon.models import Client, ClientContact, Credential, Meeting, SummonProjectProfile
from plane.summon.services import tldv
from plane.summon.services.credential import encrypt_secret

MEETING = {
    "id": "6acdf591a77a580013b2b38a",
    "name": "Data consolidation review",
    # The REST API's real format: JavaScript Date.toString(), not ISO 8601.
    "happenedAt": "Tue Oct 13 2026 09:10:41 GMT+0000 (Coordinated Universal Time)",
    "duration": 2081,
    "organizer": {"name": "Summon Development", "email": "business@with-summon.com"},
    "invitees": [],
}
TRANSCRIPT = {
    "id": "transcript-1",
    "meetingId": MEETING["id"],
    "data": [
        {"speaker": "Summon Development", "text": "Selamat sore, Bu Tiana.", "startTime": 217, "endTime": 220},
        {"speaker": "Triana", "text": "Hai, Bu Miska.", "startTime": 235, "endTime": 237},
        {"speaker": "Triana", "text": "  ", "startTime": 238, "endTime": 239},
    ],
}
NOTES = {"markdownContent": "## 1. Item Tindakan\n\n- [ ] Kirim file sampel [04:35](/app/meetings/x?t=275)"}


class FakeClient:
    results = [MEETING]

    def __init__(self, api_key):
        assert api_key == "tldv-key"

    def meetings(self, page=1, happened_after=None):
        return {"page": 1, "pages": 1, "results": self.results}

    def transcript(self, meeting_id):
        return TRANSCRIPT

    def notes(self, meeting_id):
        return NOTES


@pytest.fixture
def tldv_setup(settings, workspace, create_user, monkeypatch):
    settings.SUMMON_CREDENTIAL_KEY = Fernet.generate_key().decode()
    monkeypatch.setattr(tldv, "TldvClient", FakeClient)
    monkeypatch.setattr(
        copy_s3_object,
        "sync_with_external_service",
        lambda _entity, _html: {
            "description_json": {"type": "doc", "content": [{"type": "paragraph"}]},
            "description_binary": base64.b64encode(b"meeting-page").decode(),
        },
    )
    project = Project.objects.create(workspace=workspace, name="Delivery", identifier="TLDV")
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=20)
    credential = Credential.objects.create(
        workspace=workspace,
        owner=create_user,
        name="tl;dv",
        provider="tldv",
        secret_ciphertext=encrypt_secret("tldv-key"),
    )
    return project, credential


@pytest.mark.django_db
def test_tldv_import_keeps_speaker_turns_and_notes_and_is_idempotent(session_client, workspace, tldv_setup):
    project, credential = tldv_setup
    url = f"/api/summon/workspaces/{workspace.slug}/meetings/import/tldv/"
    body = {"credential": str(credential.id), "project": str(project.id)}

    response = session_client.post(url, body, format="json")

    assert response.status_code == status.HTTP_200_OK, response.data
    assert response.data["remaining"] == 0
    [meeting] = response.data["meetings"]
    assert meeting["title"] == "Data consolidation review"
    assert meeting["status"] == "completed"
    assert meeting["starts_at"].startswith("2026-10-13T09:10:41")
    assert meeting["ends_at"].startswith("2026-10-13T09:45:22")
    assert meeting["external_source"] == "tldv"
    assert meeting["external_url"] == f"https://tldv.io/app/meetings/{MEETING['id']}"
    assert meeting["notes"] == NOTES["markdownContent"]
    assert meeting["transcript_segments"] == [
        {"start": 217.0, "end": 220.0, "speaker": "Summon Development", "text": "Selamat sore, Bu Tiana."},
        {"start": 235.0, "end": 237.0, "speaker": "Triana", "text": "Hai, Bu Miska."},
    ]
    assert (
        meeting["transcript_text"]
        == "[03:37] Summon Development: Selamat sore, Bu Tiana.\n[03:55] Triana: Hai, Bu Miska."
    )

    # A second sync skips meetings it already imported.
    again = session_client.post(url, body, format="json")
    assert again.data["meetings"] == []
    assert Meeting.objects.filter(workspace=workspace, external_source="tldv").count() == 1


def test_client_reads_no_content_as_a_missing_transcript(monkeypatch):
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


@pytest.mark.django_db
def test_one_line_transcript_is_sent_to_live_as_html(workspace, create_user, tldv_setup, monkeypatch):
    project, _credential = tldv_setup
    sent = []
    converted = copy_s3_object.sync_with_external_service
    monkeypatch.setattr(
        copy_s3_object, "sync_with_external_service", lambda entity, html: sent.append(html) or converted(entity, html)
    )

    tldv.import_tldv_meeting(
        workspace,
        project,
        create_user,
        MEETING,
        transcript={"data": [{"speaker": "Triana", "text": "Hai & halo", "startTime": 3, "endTime": 5}]},
    )

    assert sent == ["<p>[00:03] Triana: Hai &amp; halo</p>"]


@pytest.mark.django_db
def test_tldv_import_requires_a_tldv_credential(session_client, workspace, create_user, tldv_setup):
    project, credential = tldv_setup
    credential.provider = "github"
    credential.save(update_fields=["provider"])

    response = session_client.post(
        f"/api/summon/workspaces/{workspace.slug}/meetings/import/tldv/",
        {"credential": str(credential.id), "project": str(project.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["error_code"] == "tldv_credential_required"


@pytest.mark.django_db
def test_whisper_transcript_lines_become_timed_segments(session_client, workspace, create_user, tldv_setup):
    project, _credential = tldv_setup
    response = session_client.post(
        f"/api/summon/workspaces/{workspace.slug}/meetings/",
        {
            "title": "Recorded call",
            "starts_at": "2026-10-13T09:00:00Z",
            "project": str(project.id),
            "transcript": "[00:01:05] Opening remarks\nUntimed note",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED, response.data
    assert response.data["transcript_segments"] == [
        {"start": 65.0, "end": None, "speaker": "", "text": "Opening remarks"},
        {"start": None, "end": None, "speaker": "", "text": "Untimed note"},
    ]
    assert response.data["external_url"] == ""


def _client_project(workspace, user, name, identifier, client_name):
    project = Project.objects.create(workspace=workspace, name=name, identifier=identifier)
    ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=20)
    client = Client.objects.create(workspace=workspace, name=client_name)
    SummonProjectProfile.objects.create(workspace=workspace, project=project, client=client)
    return project, client


@pytest.mark.django_db
def test_tldv_import_files_meetings_under_the_matching_client_project(
    session_client, workspace, create_user, tldv_setup, monkeypatch
):
    fallback, credential = tldv_setup
    recruitment, ish = _client_project(workspace, create_user, "Talent", "TAL", "PT Infomedia Solusi Humanika")
    ClientContact.objects.create(workspace=workspace, client=ish, name="Rina", email="rina@ish.co.id")
    # Titles name clients the short way: an acronym, or the name without its legal form.
    logistics, _ = _client_project(workspace, create_user, "Logistics", "LOGI", "PT Bangun Semangat Bersama")
    security, _ = _client_project(workspace, create_user, "Security", "SOC", "PT PLN (Persero)")
    meetings = [
        {
            **MEETING,
            "id": "by-domain",
            "name": "POC lanjutan",
            # Another person at the contact's company, plus a personal mailbox that names no client.
            "invitees": [{"name": "Budi", "email": "Budi@ish.co.id"}, {"name": "Ayu", "email": "ayu@gmail.com"}],
        },
        {**MEETING, "id": "by-acronym", "name": "[Online] Proyek PDF BSB"},
        {**MEETING, "id": "by-name", "name": "Meet WBS PLN AI Security"},
        {**MEETING, "id": "unmatched", "name": "Weekly sync", "invitees": [{"name": "Ayu", "email": "ayu@gmail.com"}]},
    ]
    monkeypatch.setattr(FakeClient, "results", meetings)

    response = session_client.post(
        f"/api/summon/workspaces/{workspace.slug}/meetings/import/tldv/",
        {"credential": str(credential.id), "project": str(fallback.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK, response.data
    projects = {meeting["title"]: str(meeting["project"]) for meeting in response.data["meetings"]}
    assert projects == {
        "POC lanjutan": str(recruitment.id),
        "[Online] Proyek PDF BSB": str(logistics.id),
        "Meet WBS PLN AI Security": str(security.id),
        "Weekly sync": str(fallback.id),
    }
    by_domain = next(meeting for meeting in response.data["meetings"] if meeting["title"] == "POC lanjutan")
    # Everyone on the invite is kept, members or not; the organizer comes first.
    assert by_domain["attendees"] == [
        {"name": "Summon Development", "email": "business@with-summon.com"},
        {"name": "Budi", "email": "budi@ish.co.id"},
        {"name": "Ayu", "email": "ayu@gmail.com"},
    ]


@pytest.mark.django_db
def test_moving_a_meeting_moves_its_transcript_page(session_client, workspace, create_user, tldv_setup):
    project, _credential = tldv_setup
    other, _client = _client_project(workspace, create_user, "Logistics", "BSB", "PT Bangun Semangat Bersama")
    meeting, _created = tldv.import_tldv_meeting(workspace, project, create_user, MEETING, transcript=TRANSCRIPT)

    response = session_client.patch(
        f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/",
        {"project": str(other.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK, response.data
    assert response.data["project_detail"]["identifier"] == "BSB"
    linked = ProjectPage.objects.filter(page_id=meeting.summary_page_id).values_list("project_id", flat=True)
    assert list(linked) == [other.id]
