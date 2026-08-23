# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

from django.utils import timezone

from plane.summon.models import AssistantAction, AssistantMessage
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


def execute_assistant_action(action, request=None):
    validate_tool(action.tool, action.arguments, write=True)
    return call_plane_tool(
        action.conversation,
        action.requester,
        action.tool,
        action.arguments,
        request=request,
    )


def handle_tool_request(conversation, user, content, tool, arguments, request=None):
    write = arguments.get("action") not in READ_ACTIONS.get(tool, set())
    validate_tool(tool, arguments, write=write)
    user_message = AssistantMessage.objects.create(
        conversation=conversation,
        workspace=conversation.workspace,
        role=AssistantMessage.Role.USER,
        content=content,
    )
    if arguments.get("action") in READ_ACTIONS.get(tool, set()):
        result = call_plane_tool(conversation, user, tool, arguments, request=request)
        assistant_message = AssistantMessage.objects.create(
            conversation=conversation,
            workspace=conversation.workspace,
            role=AssistantMessage.Role.ASSISTANT,
            content=json.dumps(result, default=str),
            provider="plane-mcp",
        )
        action = None
    else:
        preview = action_preview(tool, arguments)
        action = AssistantAction.objects.create(
            workspace=conversation.workspace,
            conversation=conversation,
            requester=user,
            tool=tool,
            arguments=sanitize_arguments(arguments),
            preview=preview,
        )
        assistant_message = AssistantMessage.objects.create(
            conversation=conversation,
            workspace=conversation.workspace,
            role=AssistantMessage.Role.ASSISTANT,
            content=preview["summary"],
            provider="plane-mcp-preview",
        )
    conversation.last_activity_at = timezone.now()
    conversation.save(update_fields=["last_activity_at", "updated_at"])
    return user_message, assistant_message, action
