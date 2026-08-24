import os

import requests
from botocore.exceptions import BotoCoreError, ClientError
from celery import shared_task

from plane.db.models import ProjectMember, User
from plane.summon.models import Meeting
from plane.summon.services.meeting_transcript import write_meeting_transcript


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
        asset.asset.open("rb")
        try:
            response = requests.post(
                os.environ.get("TRANSCRIPTION_URL", "http://transcription:8091/transcribe"),
                data=asset.asset,
                headers={
                    "Content-Type": asset.attributes.get("type", "application/octet-stream"),
                    "Content-Length": str(int(asset.size)),
                },
                timeout=1800,
            )
        finally:
            asset.asset.close()
        response.raise_for_status()
        payload = response.json()
        transcript = payload.get("text", "").strip()
        if not transcript:
            raise ValueError("empty transcript")
        write_meeting_transcript(meeting, actor, transcript, payload.get("language", ""))
    except (
        AttributeError,
        BotoCoreError,
        ClientError,
        OSError,
        requests.RequestException,
        TypeError,
        ValueError,
    ):
        meeting.summary_error = "transcription_failed"
        meeting.save(update_fields=["summary_error", "updated_at"])
