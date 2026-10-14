# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Streaming turns: the AI service (apps/ai) runs the model, Django keeps the conversation.

`start_turn` saves the user's message and a `streaming` assistant placeholder, and returns the
history and permission-scoped context the model may see. `complete_turn` writes the final reply
once; repeating it after the turn has settled changes nothing, so the AI service can retry safely.
"""

from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone

from plane.summon.models import AssistantMessage
from plane.summon.services.assistant import create_user_message, turn_context, turn_history
from plane.summon.services.context import ContextBundle


@dataclass(frozen=True)
class Turn:
    user_message: AssistantMessage
    assistant_message: AssistantMessage
    history: list[dict[str, str]]
    context: ContextBundle


def start_turn(conversation, user, content, selection, attachment_ids=()):
    user_message = create_user_message(conversation, user, content, attachment_ids)
    context = turn_context(conversation, user, content, selection)
    history = turn_history(conversation)
    assistant_message = AssistantMessage.objects.create(
        conversation=conversation,
        workspace=conversation.workspace,
        role=AssistantMessage.Role.ASSISTANT,
        content="",
        citations=context.citations,
        status=AssistantMessage.Status.STREAMING,
    )
    conversation.last_activity_at = timezone.now()
    conversation.save(update_fields=["last_activity_at", "updated_at"])
    return Turn(user_message, assistant_message, history, context)


def complete_turn(conversation, message_id, outcome):
    """Settle a streaming reply with `outcome` (validated `AssistantTurnCompleteSerializer` data)."""
    with transaction.atomic():
        message = (
            AssistantMessage.objects.select_for_update()
            .filter(conversation=conversation, role=AssistantMessage.Role.ASSISTANT)
            .get(id=message_id)
        )
        if message.status != AssistantMessage.Status.STREAMING:
            return message
        for field, value in outcome.items():
            setattr(message, field, value)
        message.save(
            update_fields=[*outcome.keys(), "updated_at"],
        )
        conversation.last_activity_at = timezone.now()
        conversation.save(update_fields=["last_activity_at", "updated_at"])
    return message
