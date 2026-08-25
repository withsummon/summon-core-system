# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from uuid import uuid4

import pytest
import requests
from cryptography.fernet import Fernet
from django.core.files.base import ContentFile
from django.core.files.storage import InMemoryStorage
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.app.services.llm import LLMError, LLMResponse
from plane.db.models import FileAsset, Page, Project, ProjectMember, ProjectPage, User, Workspace, WorkspaceMember
from plane.summon.models import (
    AssistantAction,
    AssistantAttachment,
    AssistantConversation,
    AssistantMessage,
    Client,
    Credential,
    CredentialAccessLog,
    Meeting,
)
from plane.summon.services.credential import encrypt_secret
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


@pytest.fixture
def assistant_file_storage(monkeypatch):
    storage = InMemoryStorage()
    monkeypatch.setattr(FileAsset._meta.get_field("asset"), "storage", storage)
    return storage


def assistant_asset(workspace, user, conversation, storage, name, media_type, content=b"file"):
    key = storage.save(f"{workspace.id}/{name}", ContentFile(content))
    return FileAsset.objects.create(
        workspace=workspace,
        user=user,
        created_by=user,
        asset=key,
        attributes={"name": name, "type": media_type, "size": len(content)},
        entity_type=FileAsset.EntityTypeContext.ASSISTANT_ATTACHMENT,
        entity_identifier=str(conversation.id),
        size=len(content),
        is_uploaded=True,
    )


@pytest.mark.django_db
def test_assistant_assets_accept_supported_files_and_enforce_owner_scope(
    session_client,
    workspace,
    create_user,
    monkeypatch,
):
    from plane.app.views.asset import v2

    monkeypatch.setattr(
        v2.S3Storage,
        "generate_presigned_post",
        lambda *_args, **_kwargs: {"url": "https://upload.example", "fields": {}},
    )
    conversation = AssistantConversation.objects.create(workspace=workspace, owner=create_user, title="Files")
    upload_url = f"/api/assets/v2/workspaces/{workspace.slug}/"
    payload = {
        "name": "brief.pdf",
        "type": "application/pdf",
        "size": 1024,
        "entity_type": "ASSISTANT_ATTACHMENT",
        "entity_identifier": str(conversation.id),
    }

    uploaded = session_client.post(upload_url, payload, format="json")

    assert uploaded.status_code == status.HTTP_200_OK
    asset = FileAsset.objects.get(id=uploaded.data["asset_id"])
    assert asset.user == create_user
    assert asset.entity_identifier == str(conversation.id)
    assert asset.asset_url == f"/api/assets/v2/workspaces/{workspace.slug}/{asset.id}/"
    assert session_client.post(
        upload_url,
        {**payload, "name": "script.html", "type": "text/html"},
        format="json",
    ).status_code == status.HTTP_400_BAD_REQUEST
    assert session_client.post(
        upload_url,
        {**payload, "name": "meeting.m4a", "type": "audio/mp4", "size": 8 * 1024 * 1024},
        format="json",
    ).status_code == status.HTTP_200_OK

    _, other_api = authenticated_member(workspace)
    asset_url = f"/api/assets/v2/workspaces/{workspace.slug}/{asset.id}/"
    assert other_api.patch(asset_url, {}, format="json").status_code == status.HTTP_404_NOT_FOUND
    assert session_client.patch(asset_url, {}, format="json").status_code == status.HTTP_204_NO_CONTENT
    assert session_client.get(asset_url).status_code == status.HTTP_404_NOT_FOUND

    AssistantAttachment.objects.create(
        workspace=workspace,
        conversation=conversation,
        file_asset=asset,
        original_name="brief.pdf",
        media_type="application/pdf",
        size=1024,
        status=AssistantAttachment.Status.READY,
        extracted_text="Verified scope",
    )
    monkeypatch.setattr(v2.S3Storage, "generate_presigned_url", lambda *_args, **_kwargs: "https://download.example")

    assert other_api.get(asset_url).status_code == status.HTTP_404_NOT_FOUND
    assert other_api.delete(asset_url).status_code == status.HTTP_404_NOT_FOUND
    assert session_client.get(asset_url).status_code == status.HTTP_302_FOUND


@pytest.mark.django_db
def test_assistant_attachment_extracts_document_and_serializes_safe_metadata(
    session_client,
    workspace,
    create_user,
    assistant_file_storage,
):
    conversation = AssistantConversation.objects.create(workspace=workspace, owner=create_user, title="Brief")
    asset = assistant_asset(
        workspace,
        create_user,
        conversation,
        assistant_file_storage,
        "brief.txt",
        "text/plain",
        b"Verified scope",
    )
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/{conversation.id}/attachments/"

    response = session_client.post(url, {"asset_id": str(asset.id)}, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["status"] == AssistantAttachment.Status.READY
    assert response.data["original_name"] == "brief.txt"
    assert "extracted_text" not in response.data
    attachment = AssistantAttachment.objects.get(id=response.data["id"])
    assert attachment.extracted_text == "Verified scope"
    assert session_client.get(url).data[0]["id"] == response.data["id"]


@pytest.mark.django_db
def test_assistant_attachment_audio_is_queued_and_unbound_limit_is_five(
    session_client,
    workspace,
    create_user,
    assistant_file_storage,
    django_capture_on_commit_callbacks,
    monkeypatch,
):
    from plane.summon import tasks

    conversation = AssistantConversation.objects.create(workspace=workspace, owner=create_user, title="Audio")
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/{conversation.id}/attachments/"
    calls = []
    monkeypatch.setattr(tasks.transcribe_assistant_attachment, "delay", lambda *args: calls.append(args))
    for index in range(4):
        asset = assistant_asset(
            workspace,
            create_user,
            conversation,
            assistant_file_storage,
            f"note-{index}.txt",
            "text/plain",
        )
        response = session_client.post(url, {"asset_id": str(asset.id)}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
    audio = assistant_asset(
        workspace,
        create_user,
        conversation,
        assistant_file_storage,
        "meeting.m4a",
        "audio/mp4",
    )

    with django_capture_on_commit_callbacks(execute=True):
        queued = session_client.post(url, {"asset_id": str(audio.id)}, format="json")

    assert queued.status_code == status.HTTP_201_CREATED
    assert queued.data["status"] == AssistantAttachment.Status.PROCESSING
    assert calls == [(str(queued.data["id"]), str(create_user.id))]
    sixth = assistant_asset(
        workspace,
        create_user,
        conversation,
        assistant_file_storage,
        "sixth.txt",
        "text/plain",
    )
    rejected = session_client.post(url, {"asset_id": str(sixth.id)}, format="json")
    assert rejected.status_code == status.HTTP_400_BAD_REQUEST
    assert rejected.data["error_code"] == "maximum_five_attachments"
    message = AssistantMessage.objects.create(
        workspace=workspace,
        conversation=conversation,
        role=AssistantMessage.Role.USER,
        content="Use the first file",
    )
    first = AssistantAttachment.objects.filter(conversation=conversation).order_by("created_at").first()
    first.message = message
    first.save(update_fields=["message", "updated_at"])
    assert session_client.post(url, {"asset_id": str(sixth.id)}, format="json").status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
def test_assistant_attachment_is_owner_scoped_and_only_unbound_files_can_be_deleted(
    session_client,
    workspace,
    create_user,
    assistant_file_storage,
):
    conversation = AssistantConversation.objects.create(workspace=workspace, owner=create_user, title="Private")
    asset = assistant_asset(
        workspace,
        create_user,
        conversation,
        assistant_file_storage,
        "private.txt",
        "text/plain",
    )
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/{conversation.id}/attachments/"
    created = session_client.post(url, {"asset_id": str(asset.id)}, format="json")
    detail_url = f"{url}{created.data['id']}/"
    _, other_api = authenticated_member(workspace)

    assert other_api.get(url).status_code == status.HTTP_404_NOT_FOUND
    assert other_api.post(url, {"asset_id": str(asset.id)}, format="json").status_code == status.HTTP_404_NOT_FOUND
    assert other_api.delete(detail_url).status_code == status.HTTP_404_NOT_FOUND
    message = AssistantMessage.objects.create(
        workspace=workspace,
        conversation=conversation,
        role=AssistantMessage.Role.USER,
        content="Use this file",
    )
    attachment = AssistantAttachment.objects.get(id=created.data["id"])
    attachment.message = message
    attachment.save(update_fields=["message", "updated_at"])
    assert session_client.delete(detail_url).status_code == status.HTTP_409_CONFLICT

    attachment.message = None
    attachment.save(update_fields=["message", "updated_at"])
    assert session_client.delete(detail_url).status_code == status.HTTP_204_NO_CONTENT
    assert FileAsset.all_objects.get(id=asset.id).is_deleted


@pytest.mark.django_db
def test_assistant_attachment_context_is_bound_and_retained_across_messages(
    session_client,
    workspace,
    create_user,
    assistant_file_storage,
    monkeypatch,
):
    conversation = AssistantConversation.objects.create(
        workspace=workspace,
        owner=create_user,
        title="Persistent files",
    )
    attachments = []
    for name, text in (("brief.txt", "Verified delivery scope"), ("notes.txt", "Approved launch decision")):
        asset = assistant_asset(
            workspace,
            create_user,
            conversation,
            assistant_file_storage,
            name,
            "text/plain",
            text.encode(),
        )
        attachments.append(
            AssistantAttachment.objects.create(
                workspace=workspace,
                conversation=conversation,
                file_asset=asset,
                original_name=name,
                media_type="text/plain",
                size=len(text),
                status=AssistantAttachment.Status.READY,
                extracted_text=text,
            )
        )
    processing_asset = assistant_asset(
        workspace,
        create_user,
        conversation,
        assistant_file_storage,
        "still-processing.mp3",
        "audio/mpeg",
    )
    AssistantAttachment.objects.create(
        workspace=workspace,
        conversation=conversation,
        file_asset=processing_asset,
        original_name="still-processing.mp3",
        media_type="audio/mpeg",
        size=4,
        status=AssistantAttachment.Status.PROCESSING,
    )
    captured = []

    def fake_generate(request):
        captured.append(request)
        return LLMResponse(text="Grounded answer", provider="openai", model="codex-test")

    monkeypatch.setattr("plane.summon.services.assistant.generate", fake_generate)
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/{conversation.id}/messages/"
    first = session_client.post(
        url,
        {
            "content": "Summarize these files",
            "context": {},
            "attachment_ids": [str(attachment.id) for attachment in attachments],
        },
        format="json",
    )

    assert first.status_code == status.HTTP_201_CREATED
    user_message = AssistantMessage.objects.get(id=first.data["user_message"]["id"])
    assert set(user_message.attachments.values_list("id", flat=True)) == {item.id for item in attachments}
    assert {item["id"] for item in first.data["user_message"]["attachments"]} == {item.id for item in attachments}
    prompt = repr(captured[0])
    assert "[Attached File: brief.txt]" in prompt
    assert "[Attached File: notes.txt]" in prompt
    assert "still-processing.mp3" not in prompt
    assert {item["kind"] for item in first.data["assistant_message"]["citations"]} >= {"attachment"}

    second = session_client.post(
        url,
        {"content": "What was the launch decision?", "context": {}, "attachment_ids": []},
        format="json",
    )
    assert second.status_code == status.HTTP_201_CREATED
    assert "Verified delivery scope" in repr(captured[1])
    assert "Approved launch decision" in repr(captured[1])


@pytest.mark.django_db
def test_assistant_attachment_binding_rejects_unready_foreign_and_excess_files(
    session_client,
    workspace,
    create_user,
    assistant_file_storage,
    monkeypatch,
):
    conversation = AssistantConversation.objects.create(workspace=workspace, owner=create_user, title="Validation")
    foreign_conversation = AssistantConversation.objects.create(workspace=workspace, owner=create_user, title="Foreign")

    def make_attachment(target, name, attachment_status):
        asset = assistant_asset(
            workspace,
            create_user,
            target,
            assistant_file_storage,
            name,
            "text/plain",
        )
        return AssistantAttachment.objects.create(
            workspace=workspace,
            conversation=target,
            file_asset=asset,
            original_name=name,
            media_type="text/plain",
            size=4,
            status=attachment_status,
            extracted_text="ready" if attachment_status == AssistantAttachment.Status.READY else "",
        )

    processing = make_attachment(conversation, "processing.txt", AssistantAttachment.Status.PROCESSING)
    failed = make_attachment(conversation, "failed.txt", AssistantAttachment.Status.FAILED)
    foreign = make_attachment(foreign_conversation, "foreign.txt", AssistantAttachment.Status.READY)
    monkeypatch.setattr(
        "plane.summon.services.assistant.generate",
        lambda _request: LLMResponse(text="unused", provider="openai", model="codex-test"),
    )
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/{conversation.id}/messages/"

    for attachment in (processing, failed, foreign):
        response = session_client.post(
            url,
            {"content": "Use file", "context": {}, "attachment_ids": [str(attachment.id)]},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    excessive = session_client.post(
        url,
        {"content": "Too many", "context": {}, "attachment_ids": [str(uuid4()) for _ in range(6)]},
        format="json",
    )
    assert excessive.status_code == status.HTTP_400_BAD_REQUEST
    assert not AssistantMessage.objects.filter(conversation=conversation).exists()


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
def test_assistant_action_confirm_is_idempotent_and_cancel_never_executes(
    session_client,
    workspace,
    create_user,
    monkeypatch,
):
    conversation = AssistantConversation.objects.create(workspace=workspace, owner=create_user, title="Actions")
    action = AssistantAction.objects.create(
        workspace=workspace,
        conversation=conversation,
        requester=create_user,
        tool="workitem",
        arguments={"action": "create", "project_id": str(uuid4()), "name": "Ship it"},
        preview={"title": "Create work item", "changes": {"name": "Ship it"}},
    )
    calls = []

    def execute(current, request=None):
        calls.append(current.id)
        return {"id": "created-once"}

    monkeypatch.setattr("plane.summon.views.operations.execute_assistant_action", execute)
    base = f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/{conversation.id}/actions/"

    first = session_client.post(f"{base}{action.id}/confirm/", format="json")
    second = session_client.post(f"{base}{action.id}/confirm/", format="json")
    assert first.status_code == second.status_code == status.HTTP_200_OK
    assert first.data["status"] == second.data["status"] == "completed"
    assert first.data["result"] == second.data["result"] == {"id": "created-once"}
    assert calls == [action.id]

    cancelled = AssistantAction.objects.create(
        workspace=workspace,
        conversation=conversation,
        requester=create_user,
        tool="workitem",
        arguments={"action": "update", "project_id": str(uuid4()), "work_item_id": str(uuid4())},
        preview={"title": "Update work item"},
    )
    cancelled_response = session_client.post(f"{base}{cancelled.id}/cancel/", format="json")
    confirm_cancelled = session_client.post(f"{base}{cancelled.id}/confirm/", format="json")
    assert cancelled_response.status_code == status.HTTP_200_OK
    assert cancelled_response.data["status"] == "cancelled"
    assert confirm_cancelled.status_code == status.HTTP_409_CONFLICT
    assert calls == [action.id]


@pytest.mark.django_db
def test_assistant_actions_are_owner_and_workspace_scoped(session_client, workspace, create_user):
    conversation = AssistantConversation.objects.create(workspace=workspace, owner=create_user, title="Private")
    action = AssistantAction.objects.create(
        workspace=workspace,
        conversation=conversation,
        requester=create_user,
        tool="project",
        arguments={"action": "create", "name": "Private"},
        preview={"title": "Create project"},
    )
    _, other_api = authenticated_member(workspace)
    url = (
        f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/{conversation.id}/"
        f"actions/{action.id}/confirm/"
    )

    assert other_api.post(url, format="json").status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_mcp_read_uses_user_pat_workspace_header_and_audits_use(
    session_client, workspace, create_user, settings, monkeypatch
):
    settings.SUMMON_CREDENTIAL_KEY = Fernet.generate_key().decode()
    credential = Credential.objects.create(
        workspace=workspace,
        owner=create_user,
        name="Plane PAT",
        provider="plane_mcp",
        secret_ciphertext=encrypt_secret("pat-test-only"),
    )
    conversation = AssistantConversation.objects.create(
        workspace=workspace,
        owner=create_user,
        title="MCP read",
        mcp_credential=credential,
    )
    calls = []

    class FakeResponse:
        def __init__(self, payload=None, status_code=200, headers=None):
            self.payload = payload or {}
            self.status_code = status_code
            self.headers = {"content-type": "application/json", **(headers or {})}
            self.text = ""

        def json(self):
            return self.payload

        def raise_for_status(self):
            if self.status_code >= 400:
                raise requests.HTTPError()

    def fake_post(url, headers, json, timeout):
        calls.append((headers.copy(), json))
        if json["method"] == "initialize":
            return FakeResponse({"jsonrpc": "2.0", "id": 1, "result": {}}, headers={"Mcp-Session-Id": "s-1"})
        if json["method"] == "notifications/initialized":
            return FakeResponse(status_code=202)
        return FakeResponse({"jsonrpc": "2.0", "id": 2, "result": {"projects": [{"id": "project-1"}]}})

    monkeypatch.setattr("plane.summon.services.mcp.requests.post", fake_post)
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/{conversation.id}/messages/"
    response = session_client.post(
        url,
        {"content": "List projects", "context": {}, "tool": "project", "arguments": {"action": "list"}},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["action"] is None
    assert len(calls) == 3
    assert all(call[0]["Authorization"] == "Bearer pat-test-only" for call in calls)
    assert all(call[0]["X-Workspace-slug"] == workspace.slug for call in calls)
    assert calls[-1][1]["params"] == {"name": "project", "arguments": {"action": "list"}}
    assert CredentialAccessLog.objects.filter(credential=credential, member=create_user, action="use").count() == 1


@pytest.mark.django_db
def test_mcp_write_creates_preview_without_calling_provider(
    session_client, workspace, create_user, settings, monkeypatch
):
    settings.SUMMON_CREDENTIAL_KEY = Fernet.generate_key().decode()
    credential = Credential.objects.create(
        workspace=workspace,
        owner=create_user,
        name="Plane PAT",
        provider="plane_mcp",
        secret_ciphertext=encrypt_secret("preview-pat"),
    )
    project = visible_project(workspace, create_user, "MCP")
    conversation = AssistantConversation.objects.create(
        workspace=workspace,
        owner=create_user,
        title="MCP write",
        mcp_credential=credential,
    )
    monkeypatch.setattr(
        "plane.summon.services.mcp.requests.post",
        lambda *args, **kwargs: pytest.fail("preview must not call MCP"),
    )
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/{conversation.id}/messages/"
    response = session_client.post(
        url,
        {
            "content": "Create Ship it",
            "context": {},
            "tool": "workitem",
            "arguments": {"action": "create", "project_id": str(project.id), "name": "Ship it"},
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["action"]["status"] == "pending"
    assert response.data["action"]["preview"]["changes"]["name"] == "Ship it"
    assert CredentialAccessLog.objects.filter(credential=credential, action="use").count() == 0


@pytest.mark.django_db
def test_mcp_invalid_pat_and_provider_unavailable_are_sanitized(
    session_client, workspace, create_user, settings, monkeypatch
):
    settings.SUMMON_CREDENTIAL_KEY = Fernet.generate_key().decode()
    credential = Credential.objects.create(
        workspace=workspace,
        owner=create_user,
        name="Plane PAT",
        provider="plane_mcp",
        secret_ciphertext=encrypt_secret("never-return-this-pat"),
    )
    conversation = AssistantConversation.objects.create(
        workspace=workspace,
        owner=create_user,
        title="MCP unavailable",
        mcp_credential=credential,
    )
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/{conversation.id}/messages/"

    class Unauthorized:
        status_code = 401
        headers = {"content-type": "application/json"}
        text = "invalid never-return-this-pat"

        def json(self):
            return {"detail": self.text}

    monkeypatch.setattr("plane.summon.services.mcp.requests.post", lambda *args, **kwargs: Unauthorized())
    invalid = session_client.post(
        url,
        {"content": "List", "context": {}, "tool": "project", "arguments": {"action": "list"}},
        format="json",
    )
    assert invalid.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert invalid.data == {"error_code": "mcp_http_401"}
    assert "never-return-this-pat" not in str(invalid.data)

    monkeypatch.setattr(
        "plane.summon.services.mcp.requests.post",
        lambda *args, **kwargs: (_ for _ in ()).throw(requests.ConnectionError()),
    )
    unavailable = session_client.post(
        url,
        {"content": "List", "context": {}, "tool": "project", "arguments": {"action": "list"}},
        format="json",
    )
    assert unavailable.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert unavailable.data == {"error_code": "mcp_provider_unavailable"}


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
def test_context_uses_meeting_transcript_and_generated_page_markdown(workspace, create_user):
    project = visible_project(workspace, create_user, "DOC")
    transcript_page = Page.objects.create(
        workspace=workspace,
        owned_by=create_user,
        name="Discovery transcript",
        view_props={"summon_document": {"source_transcript": "Audio decision: launch the verified pilot."}},
    )
    ProjectPage.objects.create(workspace=workspace, project=project, page=transcript_page)
    meeting = Meeting.objects.create(
        workspace=workspace,
        project=project,
        organizer=create_user,
        title="Discovery call",
        starts_at=timezone.now(),
        summary_page=transcript_page,
    )
    document_page = Page.objects.create(
        workspace=workspace,
        owned_by=create_user,
        name="Generated proposal",
        view_props={"summon_document": {"markdown": "# Proposal\n\nDocument scope: OCR rollout."}},
    )
    ProjectPage.objects.create(workspace=workspace, project=project, page=document_page)

    context = build_context(
        workspace,
        create_user,
        {"meeting_id": meeting.id, "page_ids": [document_page.id]},
    )

    assert "Audio decision: launch the verified pilot." in context.text
    assert "Document scope: OCR rollout." in context.text
    assert {citation["kind"] for citation in context.citations} == {"meeting", "page"}


@pytest.mark.django_db
def test_assistant_automatically_retrieves_authorized_project_and_document_context(
    session_client,
    workspace,
    create_user,
    monkeypatch,
):
    project = visible_project(workspace, create_user, "OCR")
    project.description = "Sucofindo handwritten field report OCR and structured extraction."
    project.save()
    page = Page.objects.create(
        workspace=workspace,
        owned_by=create_user,
        name="Sucofindo OCR project brief",
        view_props={"summon_document": {"markdown": "Verified scope: extract handwritten inspection reports."}},
    )
    ProjectPage.objects.create(workspace=workspace, project=project, page=page)

    hidden_project = Project.objects.create(
        workspace=workspace,
        name="Hidden OCR",
        identifier="HOCR",
        description="PRIVATE PROJECT MUST NOT ENTER THE PROMPT",
    )
    hidden_user, _ = authenticated_member(workspace)
    hidden_page = Page.objects.create(
        workspace=workspace,
        owned_by=hidden_user,
        name="Hidden OCR document",
        view_props={"summon_document": {"markdown": "PRIVATE DOCUMENT MUST NOT ENTER THE PROMPT"}},
    )
    ProjectPage.objects.create(workspace=workspace, project=hidden_project, page=hidden_page)
    conversation = AssistantConversation.objects.create(workspace=workspace, owner=create_user, title="RAG")
    captured = []

    def fake_generate(request):
        captured.append(request)
        return LLMResponse(text="Grounded answer", provider="openai", model="codex-test")

    monkeypatch.setattr("plane.summon.services.assistant.generate", fake_generate)
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/{conversation.id}/messages/"

    response = session_client.post(
        url,
        {"content": "Apa yang Summon kerjakan untuk handwritten report OCR?", "context": {}},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    prompt = repr(captured[0])
    assert "Sucofindo handwritten field report OCR" in prompt
    assert "extract handwritten inspection reports" in prompt
    assert "PRIVATE PROJECT MUST NOT ENTER THE PROMPT" not in prompt
    assert "PRIVATE DOCUMENT MUST NOT ENTER THE PROMPT" not in prompt
    assert {citation["kind"] for citation in response.data["assistant_message"]["citations"]} == {
        "project",
        "page",
    }


@pytest.mark.django_db
def test_send_uses_only_authorized_bounded_context_and_persists_metadata(
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
    assert "retrieved context was truncated" in captured[0].system
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
    automatic_context = captured[1].system.partition("<context>\n")[2].partition("\n</context>")[0]
    assert "[Retrieved Project]" in automatic_context
    for marker in ("TOP SECRET PROJECT", "TOP SECRET PAGE", "TOP SECRET CLIENT", "TOP SECRET CREDENTIAL"):
        assert marker not in captured[1].system
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
