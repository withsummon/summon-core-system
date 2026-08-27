# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from plane.app.views.base import BaseAPIView, BaseViewSet
from plane.db.models import FileAsset
from plane.summon.models import (
    AssistantAction,
    AssistantAttachment,
    AssistantConversation,
    AssistantMessage,
    AutomationJob,
)
from plane.summon.permissions import SummonWorkspacePermission
from plane.summon.serializers.operations import (
    AssistantActionSerializer,
    AssistantAttachmentSerializer,
    AssistantConversationListSerializer,
    AssistantConversationSerializer,
    AssistantMessageRequestSerializer,
    AssistantMessageSerializer,
)
from plane.summon.services.assistant import send_message
from plane.summon.services.assistant_action import execute_assistant_action, handle_tool_request
from plane.summon.services.assistant_attachment import create_attachment
from plane.summon.services.assistant_document import DOCUMENT_TOOL, handle_document_message, select_document_template
from plane.summon.services.mcp import MCPError
from plane.summon.views.commercial import WorkspaceContextMixin


class AssistantConversationViewSet(WorkspaceContextMixin, BaseViewSet):
    model = AssistantConversation
    serializer_class = AssistantConversationSerializer
    permission_classes = [SummonWorkspacePermission]

    def get_serializer_class(self):
        return AssistantConversationListSerializer if self.action == "list" else AssistantConversationSerializer

    def get_queryset(self):
        queryset = AssistantConversation.objects.filter(
            workspace=self.get_workspace(),
            owner=self.request.user,
        ).select_related("project", "client", "mcp_credential")
        if self.action == "list":
            return queryset
        return queryset.prefetch_related(
            Prefetch(
                "messages",
                queryset=AssistantMessage.objects.select_related("automation_job")
                .prefetch_related(
                    "attachments",
                    "automation_job__artifacts__page",
                    "automation_job__artifacts__file_asset",
                )
                .order_by("created_at"),
            ),
            Prefetch("actions", queryset=AssistantAction.objects.order_by("created_at")),
            Prefetch(
                "attachments",
                queryset=AssistantAttachment.objects.filter(message__isnull=True).order_by("created_at"),
            ),
        )

    def perform_create(self, serializer):
        serializer.save(workspace=self.get_workspace(), owner=self.request.user)


class AssistantMessageView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def get_conversation(self):
        return get_object_or_404(
            AssistantConversation,
            id=self.kwargs["conversation_id"],
            workspace=self.get_workspace(),
            owner=self.request.user,
        )

    def get(self, request, slug, conversation_id):
        messages = (
            AssistantMessage.objects.filter(conversation=self.get_conversation())
            .select_related("automation_job")
            .prefetch_related(
                "attachments",
                "automation_job__artifacts__page",
                "automation_job__artifacts__file_asset",
            )
            .order_by("created_at")
        )
        return Response(AssistantMessageSerializer(messages, many=True).data)

    def post(self, request, slug, conversation_id):
        serializer = AssistantMessageRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        conversation = self.get_conversation()
        tool = serializer.validated_data["tool"]
        if tool:
            try:
                user_message, assistant_message, action = handle_tool_request(
                    conversation,
                    request.user,
                    serializer.validated_data["content"],
                    tool,
                    serializer.validated_data["arguments"],
                    request=request,
                )
            except MCPError as error:
                return Response({"error_code": str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            return Response(
                {
                    "user_message": AssistantMessageSerializer(user_message).data,
                    "assistant_message": AssistantMessageSerializer(assistant_message).data,
                    "action": AssistantActionSerializer(action).data if action else None,
                    "context_truncated": False,
                },
                status=status.HTTP_201_CREATED,
            )
        document_result = handle_document_message(
            conversation,
            request.user,
            serializer.validated_data["content"],
            serializer.validated_data["context"],
            serializer.validated_data["attachment_ids"],
        )
        if document_result:
            user_message, assistant_message, action = document_result
            return Response(
                {
                    "user_message": AssistantMessageSerializer(user_message).data,
                    "assistant_message": AssistantMessageSerializer(assistant_message).data,
                    "action": AssistantActionSerializer(action).data,
                    "context_truncated": False,
                },
                status=status.HTTP_201_CREATED,
            )
        user_message, assistant_message, truncated, error_code = send_message(
            conversation,
            request.user,
            serializer.validated_data["content"],
            serializer.validated_data["context"],
            serializer.validated_data["intent"],
            serializer.validated_data["attachment_ids"],
        )
        data = {
            "user_message": AssistantMessageSerializer(user_message).data,
            "assistant_message": AssistantMessageSerializer(assistant_message).data,
            "context_truncated": truncated,
        }
        if error_code:
            data["error_code"] = error_code
            return Response(data, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(data, status=status.HTTP_201_CREATED)


class AssistantAttachmentView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def get_conversation(self):
        return get_object_or_404(
            AssistantConversation,
            id=self.kwargs["conversation_id"],
            workspace=self.get_workspace(),
            owner=self.request.user,
        )

    def get(self, request, slug, conversation_id):
        attachments = AssistantAttachment.objects.filter(conversation=self.get_conversation()).order_by("created_at")
        return Response(AssistantAttachmentSerializer(attachments, many=True).data)

    def post(self, request, slug, conversation_id):
        conversation = self.get_conversation()
        asset = get_object_or_404(FileAsset, id=request.data.get("asset_id"), workspace=conversation.workspace)
        attachment = create_attachment(conversation, request.user, asset)
        return Response(AssistantAttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)


class AssistantAttachmentDetailView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def delete(self, request, slug, conversation_id, attachment_id):
        attachment = get_object_or_404(
            AssistantAttachment,
            id=attachment_id,
            conversation_id=conversation_id,
            conversation__owner=request.user,
            workspace=self.get_workspace(),
        )
        if attachment.message_id:
            return Response({"error_code": "attachment_already_bound"}, status=status.HTTP_409_CONFLICT)
        now = timezone.now()
        attachment.deleted_at = now
        attachment.save(update_fields=["deleted_at", "updated_at"])
        attachment.file_asset.is_deleted = True
        attachment.file_asset.deleted_at = now
        attachment.file_asset.save(update_fields=["is_deleted", "deleted_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class AssistantActionView(WorkspaceContextMixin, BaseAPIView):
    permission_classes = [SummonWorkspacePermission]

    def get_action(self):
        return get_object_or_404(
            AssistantAction.objects.select_for_update(),
            id=self.kwargs["action_id"],
            conversation_id=self.kwargs["conversation_id"],
            conversation__owner=self.request.user,
            workspace=self.get_workspace(),
        )

    def post(self, request, slug, conversation_id, action_id, operation):
        if operation in {"select", "cancel"}:
            with transaction.atomic():
                action = self.get_action()
                if operation == "select":
                    action = select_document_template(action, request.data.get("template_id"))
                    return Response(AssistantActionSerializer(action).data)
                if action.status == AssistantAction.Status.CANCELLED:
                    return Response(AssistantActionSerializer(action).data)
                if action.status != AssistantAction.Status.PENDING:
                    return Response({"status": action.status}, status=status.HTTP_409_CONFLICT)
                action.status = AssistantAction.Status.CANCELLED
                action.save(update_fields=["status", "updated_at"])
                return Response(AssistantActionSerializer(action).data)

        with transaction.atomic():
            action = self.get_action()
            previous_status = action.status
            previous_confirmed_at = action.confirmed_at
            if operation == "retry":
                if action.tool != DOCUMENT_TOOL or action.status != AssistantAction.Status.FAILED:
                    return Response({"status": action.status}, status=status.HTTP_409_CONFLICT)
            elif action.status == AssistantAction.Status.COMPLETED:
                return Response(AssistantActionSerializer(action).data)
            elif action.status != AssistantAction.Status.PENDING:
                return Response({"status": action.status}, status=status.HTTP_409_CONFLICT)
            action.status = AssistantAction.Status.CONFIRMED
            action.confirmed_at = timezone.now()
            action.save(update_fields=["status", "confirmed_at", "updated_at"])

        try:
            result = (
                execute_assistant_action(action, request=request, retry=True)
                if operation == "retry"
                else execute_assistant_action(action, request=request)
            )
        except MCPError as error:
            with transaction.atomic():
                action = self.get_action()
                action.status = AssistantAction.Status.FAILED
                action.error = str(error)
                action.save(update_fields=["status", "error", "updated_at"])
            return Response(AssistantActionSerializer(action).data, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception:
            with transaction.atomic():
                action = self.get_action()
                if action.status == AssistantAction.Status.CONFIRMED:
                    action.status = previous_status
                    action.confirmed_at = previous_confirmed_at
                    action.save(update_fields=["status", "confirmed_at", "updated_at"])
            raise

        with transaction.atomic():
            action = self.get_action()
            if isinstance(result, AutomationJob):
                action.result = {"automation_job_id": str(result.id)}
                action.status = (
                    AssistantAction.Status.COMPLETED
                    if result.status == AutomationJob.Status.COMPLETED
                    else AssistantAction.Status.FAILED
                )
                action.error = result.error_summary
            else:
                action.result = result
                action.status = AssistantAction.Status.COMPLETED
                action.error = ""
            action.save(update_fields=["status", "result", "error", "updated_at"])
        return Response(AssistantActionSerializer(action).data)
