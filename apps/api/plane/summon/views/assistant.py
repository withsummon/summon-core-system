# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework import status
from rest_framework.response import Response

from plane.summon.views.base import SummonAPIView, SummonViewSet
from plane.db.models import FileAsset
from plane.summon.models import (
    AssistantAction,
    AssistantAttachment,
    AssistantConversation,
    AssistantMessage,
    AutomationJob,
)
from plane.summon.permissions import AIServicePermission, SummonWorkspacePermission
from plane.summon.serializers.operations import (
    AssistantActionSerializer,
    AssistantAttachmentSerializer,
    AssistantConversationListSerializer,
    AssistantConversationSerializer,
    AssistantMessageRequestSerializer,
    AssistantMessageSerializer,
    AssistantTurnCompleteSerializer,
    AssistantTurnStartSerializer,
    AssistantTurnSerializer,
    PlaneToolCallSerializer,
    PlaneToolResultSerializer,
)
from plane.summon.serializers.shapes import ErrorCodeSerializer, StatusConflictSerializer
from plane.summon.services.assistant import send_message
from plane.summon.services.assistant_action import execute_assistant_action, handle_tool_request, run_plane_tool
from plane.summon.services.assistant_attachment import create_attachment
from plane.summon.services.assistant_turn import complete_turn, start_turn
from plane.summon.services.assistant_document import DOCUMENT_TOOL, handle_document_message, select_document_template
from plane.summon.services.mcp import MCPError
from plane.summon.views.commercial import WorkspaceContextMixin


class AssistantMessageResultSerializer(serializers.Serializer):
    """Schema only: the blocking message endpoint's reply."""

    user_message = AssistantMessageSerializer()
    assistant_message = AssistantMessageSerializer()
    action = AssistantActionSerializer(allow_null=True, required=False)
    context_truncated = serializers.BooleanField()
    error_code = serializers.CharField(required=False)


class AssistantConversationViewSet(WorkspaceContextMixin, SummonViewSet):
    model = AssistantConversation
    serializer_class = AssistantConversationSerializer
    summon_tool = {"POST": "none", "PATCH": "none", "DELETE": "none"}  # conversations are managed in the app
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
                    "automation_job__artifacts__workspace",
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


class ConversationMixin(WorkspaceContextMixin):
    def get_conversation(self):
        return get_object_or_404(
            AssistantConversation,
            id=self.kwargs["conversation_id"],
            workspace=self.get_workspace(),
            owner=self.request.user,
        )


class AssistantMessageView(ConversationMixin, SummonAPIView):
    summon_tool = {"POST": "none"}  # the blocking chat endpoint; tools never start chats
    permission_classes = [SummonWorkspacePermission]

    @extend_schema(
        description="List the messages in one of your assistant conversations, oldest first.",
        responses={200: AssistantMessageSerializer(many=True)},
    )
    def get(self, request, slug, conversation_id):
        messages = (
            AssistantMessage.objects.filter(conversation=self.get_conversation())
            .select_related("automation_job")
            .prefetch_related(
                "attachments",
                "automation_job__artifacts__workspace",
                "automation_job__artifacts__page",
                "automation_job__artifacts__file_asset",
            )
            .order_by("created_at")
        )
        return Response(AssistantMessageSerializer(messages, many=True).data)

    @extend_schema(
        description="Send a message in one of your assistant conversations and wait for the reply.",
        request=AssistantMessageRequestSerializer,
        responses={201: AssistantMessageResultSerializer, 503: AssistantMessageResultSerializer},
    )
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


class AssistantAttachmentView(ConversationMixin, SummonAPIView):
    summon_tool = {"POST": "none"}  # needs an uploaded asset
    permission_classes = [SummonWorkspacePermission]

    @extend_schema(
        description="List the files attached to one of your assistant conversations.",
        responses={200: AssistantAttachmentSerializer(many=True)},
    )
    def get(self, request, slug, conversation_id):
        attachments = AssistantAttachment.objects.filter(conversation=self.get_conversation()).order_by("created_at")
        return Response(AssistantAttachmentSerializer(attachments, many=True).data)

    @extend_schema(
        description="Attach an uploaded workspace file to one of your assistant conversations.",
        request=inline_serializer("AssistantAttachmentCreate", {"asset_id": serializers.UUIDField()}),
        responses={201: AssistantAttachmentSerializer},
    )
    def post(self, request, slug, conversation_id):
        conversation = self.get_conversation()
        asset = get_object_or_404(FileAsset, id=request.data.get("asset_id"), workspace=conversation.workspace)
        attachment = create_attachment(conversation, request.user, asset)
        return Response(AssistantAttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)


class AssistantAttachmentDetailView(WorkspaceContextMixin, SummonAPIView):
    summon_tool = "none"  # attachments are managed in the app
    permission_classes = [SummonWorkspacePermission]

    @extend_schema(
        description="Remove a file from one of your assistant conversations.",
        responses={204: None, 409: ErrorCodeSerializer},
    )
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


class AssistantActionView(WorkspaceContextMixin, SummonAPIView):
    summon_tool = "none"  # confirming a pending write is the user's decision, never a tool's
    permission_classes = [SummonWorkspacePermission]

    def get_action(self):
        return get_object_or_404(
            AssistantAction.objects.select_for_update(),
            id=self.kwargs["action_id"],
            conversation_id=self.kwargs["conversation_id"],
            conversation__owner=self.request.user,
            workspace=self.get_workspace(),
        )

    @extend_schema(
        description="Confirm, choose an option for, retry or cancel an action the assistant proposed.",
        request=inline_serializer("AssistantActionOperation", {"template_id": serializers.UUIDField(required=False)}),
        responses={200: AssistantActionSerializer, 409: StatusConflictSerializer, 503: AssistantActionSerializer},
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


class AssistantTurnView(ConversationMixin, SummonAPIView):
    """Starts a streamed turn for the AI service, on behalf of the signed-in user."""

    summon_tool = "none"
    permission_classes = [SummonWorkspacePermission, AIServicePermission]

    @extend_schema(request=AssistantTurnStartSerializer, responses={201: AssistantTurnSerializer})
    def post(self, request, slug, conversation_id):
        serializer = AssistantTurnStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        turn = start_turn(
            self.get_conversation(),
            request.user,
            serializer.validated_data["content"],
            serializer.validated_data["context"],
            serializer.validated_data["attachment_ids"],
        )
        return Response(
            AssistantTurnSerializer(
                {
                    "user_message": turn.user_message,
                    "assistant_message": turn.assistant_message,
                    "history": turn.history,
                    "context": {
                        "text": turn.context.text,
                        "citations": turn.context.citations,
                        "truncated": turn.context.truncated,
                    },
                }
            ).data,
            status=status.HTTP_201_CREATED,
        )


class AssistantTurnCompleteView(ConversationMixin, SummonAPIView):
    """Settles a streamed reply once; repeating the call returns the settled message unchanged."""

    summon_tool = "none"
    permission_classes = [SummonWorkspacePermission, AIServicePermission]

    @extend_schema(request=AssistantTurnCompleteSerializer, responses={200: AssistantMessageSerializer})
    def post(self, request, slug, conversation_id, message_id):
        serializer = AssistantTurnCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            message = complete_turn(self.get_conversation(), message_id, serializer.validated_data)
        except AssistantMessage.DoesNotExist:
            return Response({"error_code": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(AssistantMessageSerializer(message).data)


class PlaneToolView(ConversationMixin, SummonAPIView):
    """Runs a Plane MCP read with the conversation's PAT, or queues a write for confirmation."""

    summon_tool = "none"
    permission_classes = [SummonWorkspacePermission, AIServicePermission]

    @extend_schema(
        request=PlaneToolCallSerializer,
        responses={200: PlaneToolResultSerializer, 201: PlaneToolResultSerializer, 503: ErrorCodeSerializer},
    )
    def post(self, request, slug, conversation_id):
        serializer = PlaneToolCallSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        conversation = self.get_conversation()
        try:
            result, action = run_plane_tool(
                conversation,
                request.user,
                serializer.validated_data["tool"],
                serializer.validated_data["arguments"],
                request=request,
            )
        except MCPError as error:
            return Response({"error_code": str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(
            PlaneToolResultSerializer({"result": result, "action": action}).data,
            status=status.HTTP_201_CREATED if action else status.HTTP_200_OK,
        )
