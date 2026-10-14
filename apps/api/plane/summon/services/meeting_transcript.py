import re

from django.utils.html import escape

from plane.db.models import Page, ProjectPage
from plane.summon.services.page_document import write_page_document


def write_meeting_transcript(meeting, actor, transcript, language="", segments=None):
    """Store the transcript on the meeting's page. `segments` ({start, end, speaker, text}, seconds) keep speaker
    turns from an importer; without them the reader falls back to the `[HH:MM:SS] text` lines Whisper writes."""
    page = meeting.summary_page
    marker = str(meeting.id)
    props = page.view_props if page and isinstance(page.view_props, dict) else {}
    if (
        not page
        or page.owned_by_id != actor.id
        or marker
        not in {
            props.get("summon_transcript_meeting_id"),
            props.get("summon_summary_meeting_id"),
        }
    ):
        page = Page(
            workspace=meeting.workspace,
            owned_by=actor,
            name=f"{meeting.title} transcript",
            access=Page.PRIVATE_ACCESS,
            is_global=False,
            view_props={"full_width": False, "summon_transcript_meeting_id": marker},
        )
    page.name = f"{meeting.title} transcript"
    page.view_props = {
        **(page.view_props if isinstance(page.view_props, dict) else {}),
        "full_width": False,
        "summon_transcript_meeting_id": marker,
    }
    write_page_document(
        page,
        # One paragraph per line: Plane Live rejects HTML without a tag, which a one-line transcript would be.
        "".join(f"<p>{escape(line)}</p>" for line in transcript.splitlines() if line.strip()) or "<p></p>",
        {
            "kind": "summon_meeting_transcript",
            "source_transcript": transcript,
            "transcription_language": language,
            **({"source_segments": segments} if segments else {}),
        },
    )
    ProjectPage.objects.get_or_create(workspace=meeting.workspace, project=meeting.project, page=page)
    meeting.summary_page = page
    meeting.summary_error = ""
    meeting.summary_provider = ""
    meeting.summary_model = ""
    meeting.summary_input_tokens = None
    meeting.summary_output_tokens = None
    meeting.save(
        update_fields=[
            "summary_page",
            "summary_error",
            "summary_provider",
            "summary_model",
            "summary_input_tokens",
            "summary_output_tokens",
            "updated_at",
        ]
    )
    return page


_WHISPER_LINE = re.compile(r"^\[(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.\d+)?\]\s*(.*)$")


def transcript_segments(metadata, transcript):
    """Speaker turns for display: an importer's stored segments, else Whisper's timed lines, else plain lines."""
    stored = metadata.get("source_segments")
    if isinstance(stored, list):
        return stored
    segments = []
    for line in transcript.splitlines():
        line = line.strip()
        if not line:
            continue
        match = _WHISPER_LINE.match(line)
        if match:
            hours, minutes, seconds, text = match.groups()
            start = int(hours or 0) * 3600 + int(minutes) * 60 + int(seconds)
            segments.append({"start": start, "end": None, "speaker": "", "text": text})
        else:
            segments.append({"start": None, "end": None, "speaker": "", "text": line})
    return segments
