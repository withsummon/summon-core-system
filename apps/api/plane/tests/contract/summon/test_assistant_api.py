# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from uuid import uuid4

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.app.services.llm import LLMError, LLMResponse
from plane.db.models import Page, Project, ProjectMember, ProjectPage, User, Workspace, WorkspaceMember
from plane.summon.models import AssistantConversation, AssistantMessage, Client, Credential, Meeting
from plane.summon.services.context import build_context


def authenticated_member(workspace):
    identity = uuid4().hex
    user = User.objects.create(email=f"assistant-{identity}@plane.test", username=f"assistant_{identity}")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    api = APIClient()
    api.force_authenticate(user=user)
    return user, api


def visible_project(workspace, user, identifier="AST"):
    project = Project.objects.create(workspace=workspace, name=f"Project {identifier}", identifier=identifier)
    ProjectMember.objects.create(workspace=workspace, project=project, member=user, role=15)
    return project


@pytest.mark.django_db
def test_conversations_are_owner_and_workspace_scoped_with_soft_delete(session_client, workspace, create_user):
    project = visible_project(workspace, create_user)
    client = Client.objects.create(workspace=workspace, name="Acme")
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/"

    created = session_client.post(
        url,
        {"title": "Delivery", "project": str(project.id), "client": str(client.id)},
        format="json",
    )

    assert created.status_code == status.HTTP_201_CREATED
    conversation_url = f"{url}{created.data['id']}/"
    other_user, other_api = authenticated_member(workspace)
    assert other_user != create_user
    assert other_api.get(url).data == []
    assert other_api.get(conversation_url).status_code == status.HTTP_404_NOT_FOUND
    stolen = other_api.patch(conversation_url, {"title": "Stolen"}, format="json")
    assert stolen.status_code == status.HTTP_404_NOT_FOUND
    assert other_api.delete(conversation_url).status_code == status.HTTP_404_NOT_FOUND

    other_workspace = Workspace.objects.create(name="Other", slug=f"other-{uuid4().hex}", owner=create_user)
    WorkspaceMember.objects.create(workspace=other_workspace, member=create_user, role=20)
    assert (
        session_client.get(
            f"/api/summon/workspaces/{other_workspace.slug}/assistant/conversations/{created.data['id']}/"
        ).status_code
        == status.HTTP_404_NOT_FOUND
    )

    updated = session_client.patch(conversation_url, {"title": "Delivery notes"}, format="json")
    assert updated.status_code == status.HTTP_200_OK
    assert updated.data["title"] == "Delivery notes"
    assert session_client.delete(conversation_url).status_code == status.HTTP_204_NO_CONTENT
    assert AssistantConversation.all_objects.get(pk=created.data["id"]).deleted_at is not None


@pytest.mark.django_db
def test_conversation_rejects_inaccessible_project_and_foreign_client(session_client, workspace, create_user):
    hidden_project = Project.objects.create(workspace=workspace, name="Hidden", identifier="HID")
    other_workspace = Workspace.objects.create(name="Foreign", slug=f"foreign-{uuid4().hex}", owner=create_user)
    foreign_client = Client.objects.create(workspace=other_workspace, name="Foreign")
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/"

    response = session_client.post(
        url,
        {"title": "Invalid", "project": str(hidden_project.id), "client": str(foreign_client.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data.keys() >= {"project", "client"}
    assert not AssistantConversation.objects.exists()


@pytest.mark.django_db
def test_context_resolves_each_explicit_selection_through_direct_read_permissions(workspace, create_user):
    project = visible_project(workspace, create_user, "CTX")
    project.description = "Authorized project description"
    project.save()
    client = Client.objects.create(workspace=workspace, name="Acme", notes="Authorized client notes")
    meeting = Meeting.objects.create(
        workspace=workspace,
        project=project,
        organizer=create_user,
        title="Delivery sync",
        agenda="Authorized agenda",
        starts_at=timezone.now(),
    )

    context = build_context(
        workspace,
        create_user,
        {
            "workspace": True,
            "project_id": project.id,
            "client_id": client.id,
            "meeting_id": meeting.id,
            "page_ids": [],
        },
    )

    assert "Test Workspace" in context.text
    assert "Authorized project description" in context.text
    assert "Authorized client notes" in context.text
    assert "Authorized agenda" in context.text
    assert {citation["kind"] for citation in context.citations} == {"project", "client", "meeting"}

    hidden_project = Project.objects.create(workspace=workspace, name="Hidden", identifier="HCX")
    hidden_meeting = Meeting.objects.create(
        workspace=workspace,
        project=hidden_project,
        organizer=create_user,
        title="Hidden meeting",
        starts_at=timezone.now(),
    )
    foreign_workspace = Workspace.objects.create(name="Foreign", slug=f"context-{uuid4().hex}", owner=create_user)
    foreign_client = Client.objects.create(workspace=foreign_workspace, name="Hidden client")
    inaccessible = build_context(
        workspace,
        create_user,
        {"meeting_id": hidden_meeting.id, "client_id": foreign_client.id, "page_ids": []},
    )
    assert inaccessible.text == ""
    assert inaccessible.citations == []


@pytest.mark.django_db
def test_send_uses_only_explicit_authorized_bounded_context_and_persists_metadata(
    session_client,
    workspace,
    create_user,
    monkeypatch,
):
    project = visible_project(workspace, create_user, "VIS")
    hidden_project = Project.objects.create(workspace=workspace, name="TOP SECRET PROJECT", identifier="SEC")
    visible_page = Page.objects.create(
        workspace=workspace,
        owned_by=create_user,
        name="Delivery plan",
        description_html=f"<p>{'A' * 40000}</p>",
    )
    ProjectPage.objects.create(workspace=workspace, project=project, page=visible_page)
    omitted_page = Page.objects.create(
        workspace=workspace,
        owned_by=create_user,
        name="Omitted after cap",
        description_html="<p>SECOND VISIBLE SOURCE MUST NOT BE CITED</p>",
    )
    ProjectPage.objects.create(workspace=workspace, project=project, page=omitted_page)
    hidden_user, _ = authenticated_member(workspace)
    hidden_page = Page.objects.create(
        workspace=workspace,
        owned_by=hidden_user,
        name="Hidden page",
        description_html="<p>TOP SECRET PAGE</p>",
    )
    ProjectPage.objects.create(workspace=workspace, project=hidden_project, page=hidden_page)
    Client.objects.create(workspace=workspace, name="Unselected client", notes="TOP SECRET CLIENT")
    Credential.objects.create(
        workspace=workspace,
        name="Never prompt",
        provider="test",
        secret_ciphertext="TOP SECRET CREDENTIAL",
    )
    conversation = AssistantConversation.objects.create(workspace=workspace, owner=create_user, title="Context")
    captured = []

    def fake_generate(request):
        captured.append(request)
        return LLMResponse(
            text="Bounded answer",
            provider="gemini",
            model="gemini-test",
            input_tokens=21,
            output_tokens=4,
        )

    monkeypatch.setattr("plane.summon.services.assistant.generate", fake_generate)
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/{conversation.id}/messages/"
    first = session_client.post(
        url,
        {
            "content": "Summarize the selected source",
            "context": {
                "project_id": str(hidden_project.id),
                "page_ids": [str(visible_page.id), str(omitted_page.id), str(hidden_page.id)],
            },
        },
        format="json",
    )

    assert first.status_code == status.HTTP_201_CREATED
    assert "selected context was truncated" in captured[0].system
    context_text = captured[0].system.partition("<context>\n")[2].partition("\n</context>")[0]
    assert len(context_text) == 30000
    assert first.data["context_truncated"] is True
    assistant = first.data["assistant_message"]
    assert assistant["provider"] == "gemini"
    assert assistant["model"] == "gemini-test"
    assert assistant["input_tokens"] == 21
    assert assistant["output_tokens"] == 4
    assert assistant["status"] == "completed"
    assert first.data["assistant_message"]["citations"] == [
        {
            "id": str(visible_page.id),
            "label": "Delivery plan",
            "href": f"/{workspace.slug}/projects/{project.id}/pages/{visible_page.id}/",
            "kind": "page",
        }
    ]
    prompt = repr(captured[0])
    for marker in (
        "SECOND VISIBLE SOURCE MUST NOT BE CITED",
        "TOP SECRET PROJECT",
        "TOP SECRET PAGE",
        "TOP SECRET CLIENT",
        "TOP SECRET CREDENTIAL",
    ):
        assert marker not in prompt
    assert str(omitted_page.id) not in {citation["id"] for citation in assistant["citations"]}

    second = session_client.post(url, {"content": "No context this time", "context": {}}, format="json")
    assert second.status_code == status.HTTP_201_CREATED
    assert captured[1].system.partition("<context>\n")[2].partition("\n</context>")[0] == ""
    assert AssistantMessage.objects.filter(conversation=conversation).count() == 4
    listed = session_client.get(url)
    assert listed.status_code == status.HTTP_200_OK
    assert [message["role"] for message in listed.data] == ["user", "assistant", "user", "assistant"]
    rewritten = session_client.patch(url, {"content": "rewrite"}, format="json")
    assert rewritten.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
    assert session_client.delete(url).status_code == status.HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.django_db
def test_provider_failure_persists_only_sanitized_retryable_message(
    session_client,
    workspace,
    create_user,
    monkeypatch,
):
    conversation = AssistantConversation.objects.create(workspace=workspace, owner=create_user, title="Failure")
    upstream_marker = "upstream-body-must-not-survive"

    def fail(_request):
        error = LLMError("llm_authentication_failed")
        error.upstream_body = upstream_marker
        raise error

    monkeypatch.setattr("plane.summon.services.assistant.generate", fail)
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/{conversation.id}/messages/"
    response = session_client.post(url, {"content": "Try the provider", "context": {}}, format="json")

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.data["error_code"] == "llm_authentication_failed"
    messages = list(AssistantMessage.objects.filter(conversation=conversation))
    assert [message.role for message in messages] == ["user", "assistant"]
    assert messages[1].status == AssistantMessage.Status.FAILED
    assert messages[1].content == "llm_authentication_failed: The LLM provider rejected its credentials."
    assert upstream_marker not in str(response.data)
    assert upstream_marker not in messages[1].content


@pytest.mark.django_db
def test_supported_deterministic_intent_is_explicitly_labeled_degraded(
    session_client,
    workspace,
    create_user,
    monkeypatch,
):
    conversation = AssistantConversation.objects.create(workspace=workspace, owner=create_user, title="Degraded")

    def unavailable(_request):
        raise LLMError("llm_not_configured")

    monkeypatch.setattr("plane.summon.services.assistant.generate", unavailable)
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/{conversation.id}/messages/"
    degraded = session_client.post(
        url,
        {"content": "How is the portfolio?", "context": {}, "intent": "portfolio_status"},
        format="json",
    )
    unsupported = session_client.post(
        url,
        {"content": "Write fiction", "context": {}, "intent": "write_fiction"},
        format="json",
    )

    assert degraded.status_code == status.HTTP_201_CREATED
    assert degraded.data["assistant_message"]["provider"] == "deterministic"
    assert degraded.data["assistant_message"]["content"].startswith("Degraded mode: ")
    assert unsupported.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert unsupported.data["assistant_message"]["status"] == "failed"
