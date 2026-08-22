# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

from django.db import transaction
from django.utils import timezone
from django.utils.html import escape
from rest_framework import serializers

from plane.app.services.llm import LLMError, LLMRequest, generate
from plane.db.models import Page, ProjectMember, ProjectPage
from plane.summon.models import AutomationJob, AutomationTemplate, GeneratedArtifact
from plane.summon.services.context import build_context
from plane.summon.services.page_document import write_page_document


DEFAULT_TEMPLATES = (
    ("Proposal", "proposal", "Create a clear proposal in Markdown from the supplied input and context."),
    ("Quotation", "quotation", "Create a clear quotation in Markdown from the supplied input and context."),
    ("Minutes of Meeting", "mom", "Create minutes of meeting in Markdown from the supplied input and context."),
    (
        "Presentation Outline",
        "presentation_outline",
        "Create a presentation outline in Markdown from the supplied input and context.",
    ),
    ("Cost Projection", "cost_projection", "Create a cost projection in Markdown from the supplied input and context."),
    ("POC Brief", "poc_brief", "Create a POC brief in Markdown from the supplied input and context."),
)
TEMPLATE_VARIABLES = {
    "proposal": ["title", "client", "scope"],
    "quotation": ["title", "client", "amount"],
    "mom": ["title", "attendees", "decisions"],
    "presentation_outline": ["title", "objective", "key_points"],
    "cost_projection": ["title", "period", "estimate"],
    "poc_brief": ["title", "problem", "success_criteria"],
}


def ensure_default_templates(workspace):
    for name, template_type, content in DEFAULT_TEMPLATES:
        AutomationTemplate.objects.get_or_create(
            workspace=workspace,
            name=name,
            defaults={
                "type": template_type,
                "description": f"LLM-assisted {name}",
                "content_template": content,
                "variables": TEMPLATE_VARIABLES[template_type],
            },
        )


def _job_input(input_data, selection, citations=None, truncated=False):
    return {
        "values": input_data,
        "context": json.loads(json.dumps(selection, default=str)),
        "citations": citations or [],
        "context_truncated": truncated,
    }


def generate_preview(template, project, requested_by, input_data, context_selection):
    job = AutomationJob.objects.create(
        workspace=template.workspace,
        template=template,
        project=project,
        requested_by=requested_by,
        type=template.type,
        status=AutomationJob.Status.RUNNING,
        input=_job_input(input_data, context_selection),
        started_at=timezone.now(),
    )
    try:
        bundle = build_context(template.workspace, requested_by, context_selection)
        response = generate(
            LLMRequest(
                system=(
                    f"{template.content_template}\n\n"
                    "Return validated Markdown only. Do not use information outside the supplied input and context."
                ),
                messages=[
                    {
                        "role": "user",
                        "content": json.dumps({"input": input_data, "context": bundle.text}, default=str),
                    }
                ],
            )
        )
        preview = response.text.strip()
        if not preview:
            raise LLMError("llm_invalid_response")
        job.status = AutomationJob.Status.COMPLETED
        job.preview_markdown = preview
        job.provider = response.provider
        job.model = response.model
        job.input_tokens = response.input_tokens
        job.output_tokens = response.output_tokens
        job.input = _job_input(input_data, context_selection, bundle.citations, bundle.truncated)
    except LLMError as error:
        job.status = AutomationJob.Status.FAILED
        job.error_summary = error.code
    except Exception:
        job.status = AutomationJob.Status.FAILED
        job.error_summary = "llm_invalid_response"
    job.completed_at = timezone.now()
    job.save(
        update_fields=[
            "status",
            "input",
            "preview_markdown",
            "provider",
            "model",
            "input_tokens",
            "output_tokens",
            "error_summary",
            "completed_at",
            "updated_at",
        ]
    )
    return job


def publish_job(job, actor):
    with transaction.atomic():
        job = (
            AutomationJob.objects.select_for_update()
            .filter(id=job.id, workspace=job.workspace, requested_by=actor)
            .first()
        )
        if not job:
            raise serializers.ValidationError({"job": "Automation job not found."})
        if not job.project_id:
            raise serializers.ValidationError(
                {"error_code": "project_required", "project": "Select an authorized Plane Project before publishing."}
            )
        membership = (
            ProjectMember.objects.select_for_update()
            .filter(
                workspace=job.workspace,
                project_id=job.project_id,
                project__deleted_at__isnull=True,
                member=actor,
                role__in=[20, 15],
                is_active=True,
            )
            .first()
        )
        if not membership:
            raise serializers.ValidationError(
                {
                    "error_code": "project_access_revoked",
                    "project": "Active Plane Project membership is required to publish this preview.",
                }
            )
        artifact = job.artifacts.select_related("page", "file_asset").first()
        if artifact:
            return artifact
        if job.status != AutomationJob.Status.COMPLETED or not job.preview_markdown:
            raise serializers.ValidationError({"job": "Only a completed preview can be published."})

        values = job.input.get("values", {})
        fallback_title = job.template.name if job.template else job.type
        title = str(values.get("title") or fallback_title).strip()[:255]
        page = Page(
            workspace=job.workspace,
            owned_by=actor,
            name=title,
            is_global=False,
            view_props={"full_width": False, "summon_automation_job_id": str(job.id)},
        )
        write_page_document(
            page,
            f"<pre>{escape(job.preview_markdown)}</pre>",
            {"kind": "summon_automation", "markdown": job.preview_markdown},
        )
        ProjectPage.objects.create(workspace=job.workspace, project=job.project, page=page)
        artifact = GeneratedArtifact.objects.create(
            workspace=job.workspace,
            job=job,
            project=job.project,
            page=page,
            title=title,
            kind=job.type,
        )
        job.published_at = timezone.now()
        job.save(update_fields=["published_at", "updated_at"])
        return artifact
