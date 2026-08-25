import base64
import io

import pytest
from django.utils import timezone
from rest_framework import status

from plane.bgtasks import copy_s3_object
from plane.db.models import FileAsset, Project, ProjectMember
from plane.summon.models import Meeting
from plane.summon.services.transcription import transcribe_file_asset


@pytest.mark.django_db
def test_attaching_a_recording_queues_transcription_after_commit(
    session_client,
    workspace,
    create_user,
    django_capture_on_commit_callbacks,
    monkeypatch,
):
    from plane.summon import tasks

    project = Project.objects.create(workspace=workspace, name="Delivery", identifier="QUEUE")
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=20)
    meeting = Meeting.objects.create(
        workspace=workspace,
        project=project,
        organizer=create_user,
        title="Delivery review",
        starts_at=timezone.now(),
    )
    asset = FileAsset.objects.create(
        workspace=workspace,
        created_by=create_user,
        asset=f"{workspace.id}/meeting.m4a",
        attributes={"name": "meeting.m4a", "type": "audio/mp4"},
        entity_type=FileAsset.EntityTypeContext.MEETING_RECORDING,
        is_uploaded=True,
    )
    calls = []
    monkeypatch.setattr(tasks.transcribe_meeting_recording, "delay", lambda *args: calls.append(args))

    with django_capture_on_commit_callbacks(execute=True):
        response = session_client.patch(
            f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/",
            {"recording_asset": str(asset.id)},
            format="json",
        )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["summary_error"] == "transcribing"
    assert calls == [(str(meeting.id), str(create_user.id))]


@pytest.mark.django_db
def test_workspace_accepts_meeting_audio_above_the_normal_asset_limit(
    session_client, workspace, create_user, monkeypatch
):
    from plane.app.views.asset import v2

    monkeypatch.setattr(
        v2.S3Storage,
        "generate_presigned_post",
        lambda *_args, **_kwargs: {"url": "https://upload.example", "fields": {}},
    )
    response = session_client.post(
        f"/api/assets/v2/workspaces/{workspace.slug}/",
        {
            "name": "meeting.m4a",
            "type": "audio/mp4",
            "size": 8 * 1024 * 1024,
            "entity_type": FileAsset.EntityTypeContext.MEETING_RECORDING,
            "entity_identifier": "meeting-id",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    asset = FileAsset.objects.get(id=response.data["asset_id"])
    assert asset.entity_identifier == "meeting-id"
    assert asset.size == 8 * 1024 * 1024
    assert asset.asset_url == f"/api/assets/v2/workspaces/{workspace.slug}/{asset.id}/"
    asset.is_uploaded = True
    asset.save(update_fields=["is_uploaded"])
    signed = {}

    def signed_url(*_args, **kwargs):
        signed.update(kwargs)
        return "https://download.example/meeting.m4a"

    monkeypatch.setattr(v2.S3Storage, "generate_presigned_url", signed_url)
    download = session_client.get(asset.asset_url)

    assert download.status_code == status.HTTP_302_FOUND
    assert signed["disposition"] == "inline"


@pytest.mark.django_db
def test_recording_transcription_is_saved_as_the_meeting_transcript(workspace, create_user, monkeypatch):
    from plane.summon import tasks

    project = Project.objects.create(workspace=workspace, name="Delivery", identifier="AUDIO")
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=20)
    asset = FileAsset.objects.create(
        workspace=workspace,
        created_by=create_user,
        asset=f"{workspace.id}/meeting.m4a",
        attributes={"name": "meeting.m4a", "type": "audio/mp4"},
        entity_type="MEETING_RECORDING",
        is_uploaded=True,
    )
    meeting = Meeting.objects.create(
        workspace=workspace,
        project=project,
        organizer=create_user,
        recording_asset=asset,
        title="Delivery review",
        starts_at=timezone.now(),
        summary_error="transcribing",
    )
    monkeypatch.setattr(asset.asset.storage, "open", lambda _name, _mode="rb": io.BytesIO(b"audio"))
    monkeypatch.setattr(
        copy_s3_object,
        "sync_with_external_service",
        lambda _entity, _html: {
            "description_json": {"type": "doc", "content": [{"type": "paragraph"}]},
            "description_binary": base64.b64encode(b"transcript-page").decode(),
        },
    )

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"text": "[00:00:00] Keputusan disetujui.", "language": "id"}

    monkeypatch.setattr("plane.summon.services.transcription.requests.post", lambda *_args, **_kwargs: Response())

    tasks.transcribe_meeting_recording(str(meeting.id), str(create_user.id))

    meeting.refresh_from_db()
    assert meeting.summary_error == ""
    assert meeting.summary_page.view_props["summon_document"]["source_transcript"] == (
        "[00:00:00] Keputusan disetujui."
    )
    assert meeting.summary_page.view_props["summon_document"]["transcription_language"] == "id"


@pytest.mark.django_db
def test_file_asset_transcription_returns_text_and_language(workspace, create_user, monkeypatch):
    asset = FileAsset.objects.create(
        workspace=workspace,
        created_by=create_user,
        asset=f"{workspace.id}/meeting.m4a",
        attributes={"name": "meeting.m4a", "type": "audio/mp4"},
        entity_type="MEETING_RECORDING",
        size=5,
        is_uploaded=True,
    )
    monkeypatch.setattr(asset.asset.storage, "open", lambda _name, _mode="rb": io.BytesIO(b"audio"))

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"text": "[00:00:00] Keputusan disetujui.", "language": "id"}

    monkeypatch.setattr("plane.summon.services.transcription.requests.post", lambda *_args, **_kwargs: Response())

    assert transcribe_file_asset(asset) == ("[00:00:00] Keputusan disetujui.", "id")
