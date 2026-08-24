from django.utils.html import escape

from plane.db.models import Page, ProjectPage
from plane.summon.services.page_document import write_page_document


def write_meeting_transcript(meeting, actor, transcript, language=""):
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
        escape(transcript).replace("\n", "<br />"),
        {
            "kind": "summon_meeting_transcript",
            "source_transcript": transcript,
            "transcription_language": language,
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
