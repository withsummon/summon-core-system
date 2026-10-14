# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

from django.utils import timezone

from plane.summon.models import AssistantAction, AssistantMessage
from plane.summon.services.assistant_document import DOCUMENT_TOOL, execute_document_action
from plane.summon.services.mcp import READ_ACTIONS, call_plane_tool, sanitize_arguments, validate_tool


def action_preview(tool, arguments):
    validate_tool(tool, arguments, write=True)
    action = arguments["action"].replace("_", " ")
    subject = arguments.get("name") or arguments.get("work_item_id") or "Plane record"
    return {
        "title": f"{action.title()} {tool}",
        "summary": f"{action.title()} {subject}",
        "changes": sanitize_arguments(arguments),
    }


def execute_assistant_action(action, request=None, retry=False):
    if action.tool == DOCUMENT_TOOL:
        return execute_document_action(action, retry=retry)
    validate_tool(action.tool, action.arguments, write=True)
    return call_plane_tool(
        action.conversation,
        action.requester,
        action.tool,
        action.arguments,
        request=request,
    )


def run_plane_tool(conversation, user, tool, arguments, request=None):
    """Run a Plane MCP read now, or record a write as a pending action for the user to confirm.

    Returns `(result, None)` for a read and `(None, action)` for a write.
    """
    write = arguments.get("action") not in READ_ACTIONS.get(tool, set())
    validate_tool(tool, arguments, write=write)
    if not write:
        return call_plane_tool(conversation, user, tool, arguments, request=request), None
    action = AssistantAction.objects.create(
        workspace=conversation.workspace,
        conversation=conversation,
        requester=user,
        tool=tool,
        arguments=sanitize_arguments(arguments),
        preview=action_preview(tool, arguments),
    )
    return None, action


def handle_tool_request(conversation, user, content, tool, arguments, request=None):
    write = arguments.get("action") not in READ_ACTIONS.get(tool, set())
    validate_tool(tool, arguments, write=write)
    user_message = AssistantMessage.objects.create(
        conversation=conversation,
        workspace=conversation.workspace,
        role=AssistantMessage.Role.USER,
        content=content,
    )
    result, action = run_plane_tool(conversation, user, tool, arguments, request=request)
    if action is None:
        assistant_message = AssistantMessage.objects.create(
            conversation=conversation,
            workspace=conversation.workspace,
            role=AssistantMessage.Role.ASSISTANT,
            content=json.dumps(result, default=str),
            provider="plane-mcp",
        )
    else:
        assistant_message = AssistantMessage.objects.create(
            conversation=conversation,
            workspace=conversation.workspace,
            role=AssistantMessage.Role.ASSISTANT,
            content=action.preview["summary"],
            provider="plane-mcp-preview",
        )
    conversation.last_activity_at = timezone.now()
    conversation.save(update_fields=["last_activity_at", "updated_at"])
    return user_message, assistant_message, action
