# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64
import io
import json

import pytest
from django.utils import timezone
from rest_framework import status

from plane.app.services.llm import LLMError, LLMResponse
from plane.bgtasks import copy_s3_object
from plane.db.models import FileAsset, Page, Project, ProjectMember, ProjectPage, User, WorkspaceMember
from plane.summon.models import Meeting, MeetingWorkItem
from plane.summon.services import meeting_summary


@pytest.fixture
def page_document_service(monkeypatch):
    monkeypatch.setattr(
        copy_s3_object,
        "sync_with_external_service",
        lambda _entity, _html: {
            "description_json": {"type": "doc", "content": [{"type": "paragraph"}]},
            "description_binary": base64.b64encode(b"canonical-meeting-page").decode(),
        },
    )


def project_for_summary(workspace, user, identifier):
    project = Project.objects.create(workspace=workspace, name=f"Project {identifier}", identifier=identifier)
    ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=20)
    return project


@pytest.mark.django_db
def test_meeting_summary_requires_a_supplied_transcript(session_client, workspace, create_user):
    project = project_for_summary(workspace, create_user, "REQ")
    meeting = Meeting.objects.create(workspace=workspace, project=project, title="Review", starts_at=timezone.now())

    response = session_client.post(
        f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/summary/",
        {},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["code"] == "transcript_required"


@pytest.mark.django_db
def test_meeting_summary_requires_an_authorized_project(session_client, workspace):
    meeting = Meeting.objects.create(workspace=workspace, title="Workspace review", starts_at=timezone.now())

    response = session_client.post(
        f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/summary/",
        {},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["error_code"] == "project_required"
    assert "project" in response.data


@pytest.mark.django_db
def test_meeting_summary_reuses_canonical_page_and_never_creates_work_items(
    session_client,
    workspace,
    create_user,
    monkeypatch,
    page_document_service,
):
    project = Project.objects.create(workspace=workspace, name="Delivery", identifier="SUM")
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=20)
    meeting = Meeting.objects.create(
        workspace=workspace,
        project=project,
        organizer=create_user,
        title="Delivery review",
        notes="PRIVATE NOTES WERE NOT SELECTED",
        starts_at=timezone.now(),
    )
    detail_url = f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/"
    supplied = session_client.patch(
        detail_url,
        {"transcript": "Decision: ship Friday. Action: prepare rollout checklist."},
        format="json",
    )
    transcript_page_id = supplied.data["summary_page"]
    captured = []

    def fake_generate(request):
        captured.append(request)
        return LLMResponse(
            text=json.dumps(
                {
                    "summary": "The team approved the Friday release.",
                    "decisions": ["Ship Friday"],
                    "action_suggestions": [
                        {"title": "Prepare rollout checklist", "details": "Confirm owners before release."}
                    ],
                    "discussion_topics": [
                        {"topic": "Release", "details": ["Friday release approved after checklist review."]}
                    ],
                    "todos_by_party": [
                        {
                            "party": "Tim Summon",
                            "items": [{"task": "Prepare rollout checklist", "notes": "Owner not recorded."}],
                        }
                    ],
                    "open_items": ["Checklist owner has not been agreed."],
                    "next_actions": [{"action": "Prepare rollout checklist", "owner": "", "due_date": ""}],
                }
            ),
            provider="anthropic",
            model="claude-test",
            input_tokens=24,
            output_tokens=12,
        )

    monkeypatch.setattr(meeting_summary, "generate", fake_generate, raising=False)
    response = session_client.post(
        f"{detail_url}summary/",
        {"context": {"project_id": str(project.id)}},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["summary_page"] == transcript_page_id
    assert response.data["summary_provider"] == "anthropic"
    assert response.data["summary_model"] == "claude-test"
    assert response.data["summary_input_tokens"] == 24
    assert response.data["summary_output_tokens"] == 12
    assert response.data["summary_error"] == ""
    assert response.data["summary_page_detail"]["summary"] == "The team approved the Friday release."
    assert response.data["summary_page_detail"]["decisions"] == ["Ship Friday"]
    assert response.data["summary_page_detail"]["action_suggestions"] == [
        {"title": "Prepare rollout checklist", "details": "Confirm owners before release."}
    ]
    markdown = response.data["summary_page_detail"]["markdown"]
    assert "# MINUTES OF MEETING" in markdown
    assert "## TO-DO LIST — Tim Summon" in markdown
    assert "| No | Tugas | Keterangan |" in markdown
    assert "## RINGKASAN PEMBAHASAN" in markdown
    assert "## KEPUTUSAN" in markdown
    assert "## OPEN ITEMS" in markdown
    assert "## NEXT ACTIONS" in markdown
    assert "Tidak tercantum" in markdown
    assert "Do not invent" in captured[0].system
    assert response.data["summary_page_detail"]["citations"][0]["id"] == str(project.id)
    assert response.data["transcript_text"] == "Decision: ship Friday. Action: prepare rollout checklist."
    assert "Decision: ship Friday" in captured[0].messages[0]["content"]
    assert project.name in captured[0].messages[0]["content"]
    assert "PRIVATE NOTES WERE NOT SELECTED" not in captured[0].messages[0]["content"]
    assert Page.objects.filter(workspace=workspace).count() == 1
    page = Page.objects.get(id=transcript_page_id)
    assert page.description_binary == b"canonical-meeting-page"
    assert page.description_json["type"] == "doc"
    assert page.view_props["summon_document"]["summary"] == "The team approved the Friday release."
    assert ProjectPage.objects.filter(workspace=workspace, project=project, page=page).exists()
    assert response.data["summary_page_detail"]["href"] == (f"/{workspace.slug}/projects/{project.id}/pages/{page.id}/")
    assert MeetingWorkItem.objects.filter(meeting=meeting).count() == 0

    read_back = session_client.get(detail_url)
    assert read_back.data["summary_page_detail"] == response.data["summary_page_detail"]


@pytest.mark.django_db
def test_meeting_summary_failure_is_sanitized_and_retryable(
    session_client, workspace, create_user, monkeypatch, page_document_service
):
    project = project_for_summary(workspace, create_user, "FAIL")
    meeting = Meeting.objects.create(
        workspace=workspace, project=project, title="Failure review", starts_at=timezone.now()
    )
    detail_url = f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/"
    session_client.patch(detail_url, {"transcript": "Supplied transcript."}, format="json")
    upstream_marker = "upstream-meeting-body-must-not-survive"

    def fail(_request):
        error = LLMError("llm_timeout")
        error.upstream_body = upstream_marker
        raise error

    monkeypatch.setattr(meeting_summary, "generate", fail, raising=False)
    response = session_client.post(f"{detail_url}summary/", {"context": {}}, format="json")

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.data["error_code"] == "llm_timeout"
    assert response.data["summary_error"] == "llm_timeout"
    assert upstream_marker not in str(response.data)
    assert response.data["transcript_text"] == "Supplied transcript."
    assert response.data["summary_page_detail"]["summary"] == ""


@pytest.mark.django_db
def test_meeting_summary_reads_only_the_supplied_text_asset(
    session_client, workspace, create_user, monkeypatch, page_document_service
):
    project = project_for_summary(workspace, create_user, "ASSET")
    asset = FileAsset.objects.create(
        workspace=workspace,
        user=create_user,
        asset=f"{workspace.id}/supplied-transcript.txt",
        attributes={"name": "supplied-transcript.txt", "content_type": "text/plain"},
        is_uploaded=True,
    )
    meeting = Meeting.objects.create(
        workspace=workspace,
        project=project,
        organizer=create_user,
        title="Asset source",
        notes="PRIVATE NOTES WERE NOT SUPPLIED",
        starts_at=timezone.now(),
        transcript_asset=asset,
    )
    monkeypatch.setattr(
        asset.asset.storage,
        "open",
        lambda _name, _mode="rb": io.BytesIO(b"Decision: use the attached transcript."),
    )
    captured = []

    def fake_generate(request):
        captured.append(request)
        return LLMResponse(
            text=json.dumps({"summary": "Attached summary", "decisions": [], "action_suggestions": []}),
            provider="openai",
            model="gpt-test",
        )

    monkeypatch.setattr(meeting_summary, "generate", fake_generate, raising=False)
    response = session_client.post(
        f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/summary/",
        {"transcript_source": "asset", "context": {}},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert "Decision: use the attached transcript." in captured[0].messages[0]["content"]
    assert "PRIVATE NOTES WERE NOT SUPPLIED" not in captured[0].messages[0]["content"]
    assert response.data["summary_page_detail"]["summary"] == "Attached summary"


@pytest.mark.django_db
def test_meeting_summary_never_overwrites_an_unrelated_linked_page(
    session_client, workspace, create_user, monkeypatch, page_document_service
):
    project = project_for_summary(workspace, create_user, "SAFE")
    unrelated = Page.objects.create(
        workspace=workspace,
        owned_by=create_user,
        name="Do not overwrite",
        description_json={"type": "doc", "content": "Unrelated content"},
        description_html="<p>Unrelated content</p>",
    )
    asset = FileAsset.objects.create(
        workspace=workspace,
        user=create_user,
        asset=f"{workspace.id}/canonical-transcript.txt",
        attributes={"name": "canonical-transcript.txt", "content_type": "text/plain"},
        is_uploaded=True,
    )
    meeting = Meeting.objects.create(
        workspace=workspace,
        project=project,
        organizer=create_user,
        title="Canonical output",
        starts_at=timezone.now(),
        transcript_asset=asset,
        summary_page=unrelated,
    )
    monkeypatch.setattr(asset.asset.storage, "open", lambda _name, _mode="rb": io.BytesIO(b"Supplied source."))
    monkeypatch.setattr(
        meeting_summary,
        "generate",
        lambda _request: LLMResponse(
            text=json.dumps({"summary": "Safe summary", "decisions": [], "action_suggestions": []}),
            provider="gemini",
            model="gemini-test",
        ),
        raising=False,
    )

    response = session_client.post(
        f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/summary/",
        {"transcript_source": "asset", "context": {}},
        format="json",
    )

    unrelated.refresh_from_db()
    assert response.status_code == status.HTTP_200_OK
    assert response.data["summary_page"] != str(unrelated.id)
    assert unrelated.name == "Do not overwrite"
    assert unrelated.description_json == {"type": "doc", "content": "Unrelated content"}
    assert Page.objects.filter(workspace=workspace).count() == 2


@pytest.mark.django_db
def test_meeting_summary_rejects_a_transcript_page_the_actor_cannot_read(
    session_client,
    workspace,
    create_user,
    monkeypatch,
):
    project = project_for_summary(workspace, create_user, "PRIVATE")
    owner = User.objects.create(email="summary-owner@plane.test", username="summary_owner")
    WorkspaceMember.objects.create(workspace=workspace, member=owner, role=15)
    private_transcript = Page.objects.create(
        workspace=workspace,
        owned_by=owner,
        name="Private transcript",
        access=Page.PRIVATE_ACCESS,
        description_html="<p>Private supplied transcript.</p>",
        view_props={"full_width": False},
    )
    ProjectPage.objects.create(workspace=workspace, project=project, page=private_transcript)
    meeting = Meeting.objects.create(
        workspace=workspace,
        project=project,
        organizer=create_user,
        title="Private source",
        starts_at=timezone.now(),
        summary_page=private_transcript,
    )
    calls = []
    monkeypatch.setattr(meeting_summary, "generate", lambda request: calls.append(request), raising=False)

    response = session_client.post(
        f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/summary/",
        {"transcript_source": "text", "context": {}},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["code"] == "transcript_required"
    assert calls == []
