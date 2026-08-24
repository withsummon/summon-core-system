# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from botocore.exceptions import BotoCoreError, ClientError
from django.db import transaction
from django.utils.html import escape
from rest_framework import serializers

from plane.app.services.llm import LLMError, LLMRequest, generate
from plane.db.models import Page, ProjectMember, ProjectPage
from plane.summon.models import Meeting
from plane.summon.services.commercial import accessible_pages
from plane.summon.services.context import build_context, cap_context
from plane.summon.services.meeting_mom import SUMMARY_SCHEMA, render_mom_markdown, validate_mom_response
from plane.summon.services.page_document import summon_document_metadata, write_page_document
from plane.summon.services.reports import visible_project_ids


def _is_canonical_page(page, meeting):
    props = page.view_props if page and isinstance(page.view_props, dict) else {}
    marker = str(meeting.id)
    return marker in {
        props.get("summon_transcript_meeting_id"),
        props.get("summon_summary_meeting_id"),
    }


def _plain_transcript(meeting, actor):
    page = meeting.summary_page
    project_ids = visible_project_ids(meeting.workspace, actor)
    if (
        not _is_canonical_page(page, meeting)
        or not accessible_pages(meeting.workspace, actor, project_ids).filter(id=page.id).exists()
    ):
        return ""
    data = summon_document_metadata(page)
    source = data.get("source_transcript")
    if isinstance(source, str):
        return source.strip()
    if page.view_props.get("summon_transcript_meeting_id") == str(meeting.id):
        return (page.description_stripped or "").strip()
    return ""


def _asset_transcript(meeting, actor):
    asset = meeting.transcript_asset
    project_ids = set(visible_project_ids(meeting.workspace, actor))
    if (
        not asset
        or asset.workspace_id != meeting.workspace_id
        or asset.is_deleted
        or asset.is_archived
        or not asset.is_uploaded
        or (asset.project_id and asset.project_id not in project_ids)
    ):
        return ""
    try:
        asset.asset.open("rb")
        try:
            return asset.asset.read(120004).decode("utf-8").strip()
        finally:
            asset.asset.close()
    except (BotoCoreError, ClientError, OSError, UnicodeDecodeError):
        return ""


def _transcript(meeting, actor, source):
    readers = {"text": _plain_transcript, "asset": _asset_transcript}
    transcript = (
        readers[source](meeting, actor)
        if source
        else _plain_transcript(meeting, actor) or _asset_transcript(meeting, actor)
    )
    if not transcript:
        meeting.summary_error = "transcript_required"
        meeting.save(update_fields=["summary_error", "updated_at"])
        raise serializers.ValidationError(
            {"code": "transcript_required", "detail": "Supply an accessible text transcript before summarizing."}
        )
    return transcript


def _save_failure(meeting, code):
    meeting.summary_error = code
    meeting.save(update_fields=["summary_error", "updated_at"])


def summarize_meeting(meeting, actor, selection, transcript_source=None):
    transcript = _transcript(meeting, actor, transcript_source)
    project_ids = visible_project_ids(meeting.workspace, actor)
    if (
        _is_canonical_page(meeting.summary_page, meeting)
        and not accessible_pages(meeting.workspace, actor, project_ids).filter(id=meeting.summary_page_id).exists()
    ):
        _save_failure(meeting, "llm_invalid_response")
        raise LLMError("llm_invalid_response")
    bundle = build_context(meeting.workspace, actor, selection)
    source, source_truncated = cap_context([f"[Transcript]\n{transcript}", bundle.text])
    try:
        response = generate(
            LLMRequest(
                system=(
                    "Create a professional Summon Minutes of Meeting from only the supplied transcript and "
                    "explicitly selected context. Follow the Summon Toolkit structure: discussion grouped by "
                    "topic, locked decisions, explicitly open items, to-do lists separated by party, and next "
                    "actions. Do not invent participants, clients, document numbers, decisions, parties, owners, "
                    "or due dates. Use empty owner and due_date strings when unsupported. Distinguish proposals "
                    "and questions from decisions. Return JSON matching the schema."
                ),
                messages=[{"role": "user", "content": source}],
                response_schema=SUMMARY_SCHEMA,
            )
        )
        result = validate_mom_response(response.text)
    except LLMError as error:
        _save_failure(meeting, error.code)
        raise

    markdown = render_mom_markdown(meeting, result)
    with transaction.atomic():
        meeting = Meeting.objects.select_for_update().get(id=meeting.id)
        membership = (
            ProjectMember.objects.select_for_update()
            .filter(
                workspace=meeting.workspace,
                project_id=meeting.project_id,
                project__deleted_at__isnull=True,
                member=actor,
                role__in=[20, 15],
                is_active=True,
            )
            .first()
        )
        if not meeting.project_id or not membership:
            raise serializers.ValidationError(
                {"error_code": "project_access_revoked", "project": "Active Project membership is required."}
            )
        page = meeting.summary_page
        if not _is_canonical_page(page, meeting):
            page = None
        if page and not accessible_pages(meeting.workspace, actor, project_ids).filter(id=page.id).exists():
            raise LLMError("llm_invalid_response")
        if not page:
            page = Page(
                workspace=meeting.workspace,
                owned_by=actor,
                name=f"{meeting.title} MoM",
                is_global=False,
            )
        page.name = f"{meeting.title} MoM"
        page.view_props = {
            **(page.view_props if isinstance(page.view_props, dict) else {}),
            "summon_summary_meeting_id": str(meeting.id),
        }
        write_page_document(
            page,
            f"<pre>{escape(markdown)}</pre>",
            {
                "kind": "summon_mom",
                "markdown": markdown,
                "source_transcript": transcript,
                **result,
                "citations": bundle.citations,
                "context_truncated": bundle.truncated or source_truncated,
            },
        )
        ProjectPage.objects.get_or_create(workspace=meeting.workspace, project=meeting.project, page=page)
        meeting.summary_page = page
        meeting.summary_error = ""
        meeting.summary_provider = response.provider
        meeting.summary_model = response.model
        meeting.summary_input_tokens = response.input_tokens
        meeting.summary_output_tokens = response.output_tokens
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
    return meeting
