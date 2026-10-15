from celery import shared_task
from django.utils import timezone

from plane.db.models import ProjectMember, User
from plane.summon.models import AssistantAttachment, DriveFolder, Meeting
from plane.summon.services.google_drive import (
    CHANNEL_RENEW_WITHIN,
    GoogleDriveError,
    record_drive_error,
    run_drive_sync,
    watch_drive_folder,
    webhook_address,
)
from plane.summon.services.meeting_transcript import write_meeting_transcript
from plane.summon.services.transcription import TranscriptionError, transcribe_file_asset


@shared_task
def transcribe_meeting_recording(meeting_id, actor_id):
    meeting = Meeting.objects.select_related("recording_asset", "project", "workspace").filter(id=meeting_id).first()
    actor = User.objects.filter(id=actor_id).first()
    asset = meeting.recording_asset if meeting else None
    if (
        not meeting
        or not actor
        or not meeting.project_id
        or not asset
        or asset.workspace_id != meeting.workspace_id
        or asset.entity_type != "MEETING_RECORDING"
        or asset.is_deleted
        or asset.is_archived
        or not asset.is_uploaded
        or not ProjectMember.objects.filter(
            workspace=meeting.workspace,
            project=meeting.project,
            member=actor,
            role__in=[20, 15],
            is_active=True,
        ).exists()
    ):
        if meeting:
            meeting.summary_error = "transcription_failed"
            meeting.save(update_fields=["summary_error", "updated_at"])
        return

    try:
        transcript, language = transcribe_file_asset(asset)
        write_meeting_transcript(meeting, actor, transcript, language)
    except TranscriptionError:
        meeting.summary_error = "transcription_failed"
        meeting.save(update_fields=["summary_error", "updated_at"])


@shared_task
def transcribe_assistant_attachment(attachment_id, actor_id):
    attachment = (
        AssistantAttachment.objects.select_related("conversation", "file_asset")
        .filter(id=attachment_id, conversation__owner_id=actor_id)
        .first()
    )
    asset = attachment.file_asset if attachment else None
    if (
        not attachment
        or not asset
        or asset.workspace_id != attachment.workspace_id
        or asset.user_id != attachment.conversation.owner_id
        or asset.entity_type != "ASSISTANT_ATTACHMENT"
        or asset.entity_identifier != str(attachment.conversation_id)
        or asset.is_deleted
        or asset.is_archived
        or not asset.is_uploaded
    ):
        if attachment:
            attachment.status = AssistantAttachment.Status.FAILED
            attachment.error = "transcription_failed"
            attachment.save(update_fields=["status", "error", "updated_at"])
        return
    try:
        attachment.extracted_text, attachment.language = transcribe_file_asset(asset)
        attachment.status = AssistantAttachment.Status.READY
        attachment.error = ""
        attachment.save(update_fields=["extracted_text", "language", "status", "error", "updated_at"])
    except TranscriptionError:
        attachment.status = AssistantAttachment.Status.FAILED
        attachment.error = "transcription_failed"
        attachment.save(update_fields=["status", "error", "updated_at"])


@shared_task
def sync_drive_changes(folder_id):
    run_drive_sync(folder_id)


@shared_task
def refresh_drive_folders():
    """The safety net under push notifications, which Drive does not promise to deliver: read every folder's
    change feed, and renew push channels before Drive lets them lapse."""
    renew_before = timezone.now() + CHANNEL_RENEW_WITHIN
    for folder_id in DriveFolder.objects.values_list("id", flat=True):
        folder = run_drive_sync(folder_id)
        if folder and webhook_address() and (not folder.channel_expires_at or folder.channel_expires_at < renew_before):
            try:
                watch_drive_folder(folder)
            except GoogleDriveError as error:
                record_drive_error(folder, error)
