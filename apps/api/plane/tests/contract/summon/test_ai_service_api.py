# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""The protocol between Django and the AI service (`apps/ai`), and API-key access for MCP clients."""

from unittest import mock

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import APIToken, Workspace, WorkspaceMember
from plane.license.models import InstanceConfiguration
from plane.summon.models import AssistantAction, AssistantConversation, AssistantMessage
from plane.summon.services.mcp import MCPError

TOKEN = "ai-service-token"


@pytest.fixture
def ai_service(settings):
    settings.SUMMON_AI_INTERNAL_TOKEN = TOKEN


@pytest.fixture
def conversation(workspace, create_user):
    return AssistantConversation.objects.create(workspace=workspace, owner=create_user, title="Delivery")


def conversation_url(workspace, conversation, suffix):
    return f"/api/summon/workspaces/{workspace.slug}/assistant/conversations/{conversation.id}/{suffix}"


def start(session_client, workspace, conversation, **headers):
    return session_client.post(
        conversation_url(workspace, conversation, "turns/"),
        {"content": "What is at risk this week?"},
        format="json",
        **headers,
    )


@pytest.mark.django_db
def test_turn_requires_the_ai_service_token(session_client, workspace, conversation, ai_service):
    assert start(session_client, workspace, conversation).status_code == status.HTTP_403_FORBIDDEN
    wrong = start(session_client, workspace, conversation, HTTP_X_SUMMON_AI_TOKEN="wrong")
    assert wrong.status_code == status.HTTP_403_FORBIDDEN
    assert not AssistantMessage.objects.filter(conversation=conversation).exists()


@pytest.mark.django_db
def test_turn_is_refused_when_no_token_is_configured(session_client, workspace, conversation, settings):
    settings.SUMMON_AI_INTERNAL_TOKEN = ""
    response = start(session_client, workspace, conversation, HTTP_X_SUMMON_AI_TOKEN="")
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_turn_start_saves_the_question_and_a_streaming_reply(session_client, workspace, conversation, ai_service):
    AssistantMessage.objects.create(
        workspace=workspace, conversation=conversation, role=AssistantMessage.Role.USER, content="Earlier question"
    )
    AssistantMessage.objects.create(
        workspace=workspace, conversation=conversation, role=AssistantMessage.Role.ASSISTANT, content="Earlier answer"
    )

    response = start(session_client, workspace, conversation, HTTP_X_SUMMON_AI_TOKEN=TOKEN)

    assert response.status_code == status.HTTP_201_CREATED
    reply = AssistantMessage.objects.get(id=response.data["assistant_message"]["id"])
    assert reply.status == AssistantMessage.Status.STREAMING
    assert response.data["user_message"]["content"] == "What is at risk this week?"
    assert [turn["content"] for turn in response.data["history"]] == [
        "Earlier question",
        "Earlier answer",
        "What is at risk this week?",
    ]
    assert set(response.data["context"]) == {"text", "citations", "truncated"}


@pytest.mark.django_db
def test_turn_start_is_limited_to_the_conversation_owner(workspace, conversation, ai_service, django_user_model):
    other = django_user_model.objects.create(email="other@summon.test", username="other")
    WorkspaceMember.objects.create(workspace=workspace, member=other, role=15)
    client = APIClient()
    client.force_authenticate(user=other)

    response = start(client, workspace, conversation, HTTP_X_SUMMON_AI_TOKEN=TOKEN)

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_turn_complete_settles_the_reply_once(session_client, workspace, conversation, ai_service):
    reply_id = start(session_client, workspace, conversation, HTTP_X_SUMMON_AI_TOKEN=TOKEN).data["assistant_message"][
        "id"
    ]
    url = conversation_url(workspace, conversation, f"turns/{reply_id}/complete/")
    payload = {
        "status": "completed",
        "content": "Two work items are overdue.",
        "parts": [{"type": "text", "text": "Two work items are overdue."}],
        "provider": "openrouter",
        "model": "openai/gpt-5-mini",
        "input_tokens": 120,
        "output_tokens": 9,
        "usage": {"cached_input_tokens": 100, "ttft_ms": 410},
    }

    first = session_client.post(url, payload, format="json", HTTP_X_SUMMON_AI_TOKEN=TOKEN)
    repeat = session_client.post(
        url, {**payload, "content": "A retried, different body"}, format="json", HTTP_X_SUMMON_AI_TOKEN=TOKEN
    )

    assert first.status_code == repeat.status_code == status.HTTP_200_OK
    assert repeat.data == first.data
    reply = AssistantMessage.objects.get(id=reply_id)
    assert reply.status == AssistantMessage.Status.COMPLETED
    assert reply.content == "Two work items are overdue."
    assert (reply.input_tokens, reply.output_tokens) == (120, 9)


@pytest.mark.django_db
def test_failed_turn_needs_an_error_code(session_client, workspace, conversation, ai_service):
    reply_id = start(session_client, workspace, conversation, HTTP_X_SUMMON_AI_TOKEN=TOKEN).data["assistant_message"][
        "id"
    ]
    url = conversation_url(workspace, conversation, f"turns/{reply_id}/complete/")

    missing = session_client.post(url, {"status": "failed", "content": ""}, format="json", HTTP_X_SUMMON_AI_TOKEN=TOKEN)
    failed = session_client.post(
        url,
        {"status": "failed", "content": "", "error_code": "llm_rate_limited"},
        format="json",
        HTTP_X_SUMMON_AI_TOKEN=TOKEN,
    )

    assert missing.status_code == status.HTTP_400_BAD_REQUEST
    assert failed.status_code == status.HTTP_200_OK
    assert AssistantMessage.objects.get(id=reply_id).status == AssistantMessage.Status.FAILED


@pytest.mark.django_db
def test_turn_complete_rejects_unknown_and_user_messages(session_client, workspace, conversation, ai_service):
    question = AssistantMessage.objects.create(
        workspace=workspace, conversation=conversation, role=AssistantMessage.Role.USER, content="Hi"
    )
    payload = {"status": "completed", "content": "x"}
    for message_id in ("00000000-0000-0000-0000-000000000000", question.id):
        response = session_client.post(
            conversation_url(workspace, conversation, f"turns/{message_id}/complete/"),
            payload,
            format="json",
            HTTP_X_SUMMON_AI_TOKEN=TOKEN,
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_plane_tool_reads_now(session_client, workspace, conversation, ai_service):
    with mock.patch(
        "plane.summon.services.assistant_action.call_plane_tool", return_value={"results": [{"name": "Website"}]}
    ) as call:
        response = session_client.post(
            conversation_url(workspace, conversation, "plane-tools/"),
            {"tool": "project", "arguments": {"action": "list"}},
            format="json",
            HTTP_X_SUMMON_AI_TOKEN=TOKEN,
        )

    assert response.status_code == status.HTTP_200_OK
    assert response.data == {"result": {"results": [{"name": "Website"}]}, "action": None}
    assert call.call_args.args[2:4] == ("project", {"action": "list"})


@pytest.mark.django_db
def test_plane_tool_queues_writes_for_confirmation(session_client, workspace, conversation, ai_service):
    with mock.patch("plane.summon.services.assistant_action.call_plane_tool") as call:
        response = session_client.post(
            conversation_url(workspace, conversation, "plane-tools/"),
            {"tool": "workitem", "arguments": {"action": "create", "project_id": "p1", "name": "Fix login"}},
            format="json",
            HTTP_X_SUMMON_AI_TOKEN=TOKEN,
        )

    assert response.status_code == status.HTTP_201_CREATED
    call.assert_not_called()
    action = AssistantAction.objects.get(id=response.data["action"]["id"])
    assert action.status == AssistantAction.Status.PENDING
    assert response.data["result"] is None


@pytest.mark.django_db
def test_plane_tool_reports_plane_outages(session_client, workspace, conversation, ai_service):
    with mock.patch("plane.summon.services.assistant_action.call_plane_tool", side_effect=MCPError("mcp_unavailable")):
        response = session_client.post(
            conversation_url(workspace, conversation, "plane-tools/"),
            {"tool": "project", "arguments": {"action": "list"}},
            format="json",
            HTTP_X_SUMMON_AI_TOKEN=TOKEN,
        )

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.data == {"error_code": "mcp_unavailable"}


@pytest.mark.django_db
def test_plane_tool_requires_the_ai_service_token(session_client, workspace, conversation, ai_service):
    response = session_client.post(
        conversation_url(workspace, conversation, "plane-tools/"),
        {"tool": "project", "arguments": {"action": "list"}},
        format="json",
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_api_key_reads_summon_in_its_own_workspace(api_client, workspace, create_user):
    APIToken.objects.create(user=create_user, workspace=workspace, label="MCP", token="plane_api_scoped")
    api_client.credentials(HTTP_X_API_KEY="plane_api_scoped")

    response = api_client.get(f"/api/summon/workspaces/{workspace.slug}/clients/")

    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_api_key_is_rejected_in_another_workspace(api_client, workspace, create_user):
    other = Workspace.objects.create(name="Other", owner=create_user, slug="other-workspace")
    WorkspaceMember.objects.create(workspace=other, member=create_user, role=20)
    APIToken.objects.create(user=create_user, workspace=workspace, label="MCP", token="plane_api_scoped")
    api_client.credentials(HTTP_X_API_KEY="plane_api_scoped")

    response = api_client.get(f"/api/summon/workspaces/{other.slug}/clients/")

    # DRF answers 403 for a failed authenticator when session auth comes first; the reason is the key.
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.data["detail"] == "This API token belongs to a different workspace"


@pytest.mark.django_db
def test_api_keys_never_reach_credentials(api_key_client, workspace):
    response = api_key_client.get(f"/api/summon/workspaces/{workspace.slug}/credentials/")
    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
def test_internal_ai_config_requires_the_token(api_client, ai_service):
    assert api_client.get("/api/summon/internal/ai-config/").status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_internal_ai_config_returns_the_openrouter_settings(api_client, ai_service, settings):
    settings.SKIP_ENV_VAR = True
    for key, value in (
        ("LLM_PROVIDER", "openrouter"),
        ("LLM_MODEL", "openai/gpt-5-mini"),
        ("LLM_API_KEY", "sk-or-test"),
        ("LLM_REQUEST_TIMEOUT_SECONDS", "60"),
    ):
        InstanceConfiguration.objects.update_or_create(
            key=key, defaults={"value": value, "category": "AI", "is_encrypted": False}
        )

    response = api_client.get("/api/summon/internal/ai-config/", HTTP_X_SUMMON_AI_TOKEN=TOKEN)

    assert response.status_code == status.HTTP_200_OK
    assert response["Cache-Control"] == "no-store"
    assert response.data == {
        "provider": "openrouter",
        "model": "openai/gpt-5-mini",
        "api_key": "sk-or-test",
        "base_url": "https://openrouter.ai/api/v1",
        "timeout_seconds": 60,
    }
