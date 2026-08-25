from celery import shared_task

from plane.db.models import ProjectMember, User
from plane.summon.models import AssistantAttachment, Meeting
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
