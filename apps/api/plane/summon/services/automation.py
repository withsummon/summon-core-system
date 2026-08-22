# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import transaction
from django.template import Context, Template
from django.utils import timezone
from django.utils.html import escape

from plane.db.models import Page, ProjectPage
from plane.summon.models import AutomationJob, AutomationTemplate, GeneratedArtifact


DEFAULT_TEMPLATES = (
    ("Proposal", "proposal", "# {{ title|default:'Proposal' }}\n\n**Client:** {{ client }}\n\n## Scope\n{{ scope }}"),
    (
        "Quotation",
        "quotation",
        "# {{ title|default:'Quotation' }}\n\n**Client:** {{ client }}\n\n**Amount:** {{ amount }}",
    ),
    (
        "Minutes of Meeting",
        "mom",
        "# {{ title|default:'Minutes of Meeting' }}\n\n## Attendees\n{{ attendees }}\n\n## Decisions\n{{ decisions }}",
    ),
    (
        "Presentation Outline",
        "presentation_outline",
        "# {{ title|default:'Presentation' }}\n\n## Objective\n{{ objective }}\n\n## Key points\n{{ key_points }}",
    ),
    (
        "Cost Projection",
        "cost_projection",
        "# {{ title|default:'Cost Projection' }}\n\n**Period:** {{ period }}\n\n**Estimate:** {{ estimate }}",
    ),
    (
        "POC Brief",
        "poc_brief",
        "# {{ title|default:'POC Brief' }}\n\n## Problem\n{{ problem }}\n\n## Success criteria\n{{ success_criteria }}",
    ),
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
                "description": f"Deterministic {name} template",
                "content_template": content,
                "variables": TEMPLATE_VARIABLES[template_type],
            },
        )


def run_automation(template, project, requested_by, input_data):
    job = AutomationJob.objects.create(
        workspace=template.workspace,
        template=template,
        project=project,
        requested_by=requested_by,
        type=template.type,
        status=AutomationJob.Status.RUNNING,
        input=input_data,
        started_at=timezone.now(),
    )
    try:
        markdown = Template(template.content_template).render(Context(input_data, autoescape=False))
        title = str(input_data.get("title") or template.name)
        with transaction.atomic():
            page = Page.objects.create(
                workspace=template.workspace,
                owned_by=requested_by,
                name=title,
                is_global=project is None,
                description_json={"type": "summon_markdown", "markdown": markdown},
                description_html=f"<pre>{escape(markdown)}</pre>",
            )
            if project:
                ProjectPage.objects.create(workspace=template.workspace, project=project, page=page)
            GeneratedArtifact.objects.create(
                workspace=template.workspace,
                job=job,
                project=project,
                page=page,
                title=title,
                kind=template.type,
            )
            job.status = AutomationJob.Status.COMPLETED
            job.completed_at = timezone.now()
            job.save(update_fields=["status", "completed_at", "updated_at"])
    except Exception:
        job.status = AutomationJob.Status.FAILED
        job.error_summary = "Artifact generation failed."
        job.completed_at = timezone.now()
        job.save(update_fields=["status", "error_summary", "completed_at", "updated_at"])
        raise
    return job
