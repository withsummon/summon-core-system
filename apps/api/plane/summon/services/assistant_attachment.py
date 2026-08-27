from pathlib import Path

from django.conf import settings
from django.db import transaction
from rest_framework import serializers

from plane.db.models import FileAsset
from plane.summon.models import AssistantAttachment, AssistantConversation
from plane.summon.services.context_document import MAX_UPLOAD_BYTES, extract_context_document

DOCUMENT_TYPES = {
    ".csv": {"text/csv"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ".md": {"text/markdown"},
    ".pdf": {"application/pdf"},
    ".pptx": {"application/vnd.openxmlformats-officedocument.presentationml.presentation"},
    ".txt": {"text/plain"},
    ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
}
AUDIO_TYPES = {
    ".m4a": {"audio/mp4", "audio/m4a", "audio/x-m4a"},
    ".mp3": {"audio/mpeg", "audio/mp3"},
}


def _validate_asset(conversation, actor, asset):
    name = Path(asset.attributes.get("name", "")).name
    media_type = asset.attributes.get("type", "")
    extension = Path(name).suffix.lower()
    allowed_types = DOCUMENT_TYPES.get(extension) or AUDIO_TYPES.get(extension)
    if (
        conversation.owner_id != actor.id
        or asset.workspace_id != conversation.workspace_id
        or asset.user_id != actor.id
        or asset.entity_type != FileAsset.EntityTypeContext.ASSISTANT_ATTACHMENT
        or asset.entity_identifier != str(conversation.id)
        or not asset.is_uploaded
        or asset.is_deleted
        or asset.is_archived
        or not allowed_types
        or media_type not in allowed_types
        or asset.size <= 0
        or (extension in DOCUMENT_TYPES and asset.size > MAX_UPLOAD_BYTES)
        or (extension in AUDIO_TYPES and asset.size > settings.SUMMON_RECORDING_FILE_SIZE_LIMIT)
    ):
        raise serializers.ValidationError({"asset_id": "Invalid assistant attachment."})
    return name, media_type, extension


def _validate_attachment_slot(conversation, asset):
    if AssistantAttachment.objects.filter(file_asset=asset).exists():
        raise serializers.ValidationError({"asset_id": "Attachment already exists."})
    if AssistantAttachment.objects.filter(conversation=conversation, message__isnull=True).count() >= 5:
        raise serializers.ValidationError({"error_code": "maximum_five_attachments"})


def create_attachment(conversation, actor, asset):
    name, media_type, extension = _validate_asset(conversation, actor, asset)
    _validate_attachment_slot(conversation, asset)

    extracted_text = ""
    status = AssistantAttachment.Status.PROCESSING
    if extension in DOCUMENT_TYPES:
        asset.asset.open("rb")
        try:
            extracted_text = extract_context_document(asset.asset)["text"]
        finally:
            asset.asset.close()
        status = AssistantAttachment.Status.READY

    with transaction.atomic():
        conversation = AssistantConversation.objects.select_for_update().get(pk=conversation.pk)
        _validate_attachment_slot(conversation, asset)
        attachment = AssistantAttachment.objects.create(
            workspace=conversation.workspace,
            conversation=conversation,
            file_asset=asset,
            original_name=name,
            media_type=media_type,
            size=asset.size,
            status=status,
            extracted_text=extracted_text,
        )
        if status == AssistantAttachment.Status.PROCESSING:
            from plane.summon.tasks import transcribe_assistant_attachment

            transaction.on_commit(lambda: transcribe_assistant_attachment.delay(str(attachment.id), str(actor.id)))
    return attachment


def attachment_context_entries(conversation, actor, attachment_ids=None):
    attachments = AssistantAttachment.objects.filter(
        conversation=conversation,
        conversation__owner=actor,
        workspace=conversation.workspace,
        status=AssistantAttachment.Status.READY,
    ).order_by("created_at")
    if attachment_ids is not None:
        attachments = attachments.filter(id__in=attachment_ids)
    return [
        (
            f"[Attached File: {attachment.original_name}]\n{attachment.extracted_text}",
            {
                "id": str(attachment.id),
                "label": attachment.original_name,
                "href": attachment.file_asset.asset_url,
                "kind": "attachment",
            },
        )
        for attachment in attachments.select_related("file_asset__workspace")
    ]
