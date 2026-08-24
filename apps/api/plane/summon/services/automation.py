# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

from django.core.files.base import ContentFile
from django.db import transaction
from django.http import Http404
from django.utils import timezone
from django.utils.html import escape
from rest_framework import serializers

from plane.app.services.llm import LLMError, LLMRequest, generate
from plane.db.models import FileAsset, Page, ProjectMember, ProjectPage
from plane.summon.models import AutomationJob, AutomationTemplate, GeneratedArtifact
from plane.summon.services.context import build_context
from plane.summon.services.document_renderer import render_document_files
from plane.summon.services.page_document import write_page_document
from plane.summon.services.automation_templates import DEFAULT_TEMPLATES

SYSTEM_TEMPLATE_SOURCE = "summon_system"
LEGACY_TEMPLATES = {
    "proposal": (
        "Proposal",
        ["title", "client", "scope"],
        "# {{ title|default:'Proposal' }}\n\n**Client:** {{ client }}\n\n## Scope\n{{ scope }}",
    ),
    "quotation": (
        "Quotation",
        ["title", "client", "amount"],
        "# {{ title|default:'Quotation' }}\n\n**Client:** {{ client }}\n\n**Amount:** {{ amount }}",
    ),
    "mom": (
        "Minutes of Meeting",
        ["title", "attendees", "decisions"],
        "# {{ title|default:'Minutes of Meeting' }}\n\n## Attendees\n{{ attendees }}\n\n## Decisions\n{{ decisions }}",
    ),
    "presentation_outline": (
        "Presentation Outline",
        ["title", "objective", "key_points"],
        "# {{ title|default:'Presentation' }}\n\n## Objective\n{{ objective }}\n\n## Key points\n{{ key_points }}",
    ),
    "cost_projection": (
        "Cost Projection",
        ["title", "period", "estimate"],
        "# {{ title|default:'Cost Projection' }}\n\n**Period:** {{ period }}\n\n**Estimate:** {{ estimate }}",
    ),
    "poc_brief": (
        "POC Brief",
        ["title", "problem", "success_criteria"],
        "# {{ title|default:'POC Brief' }}\n\n## Problem\n{{ problem }}\n\n## Success criteria\n{{ success_criteria }}",
    ),
}
RETIRED_TEMPLATE_TYPES = ("proposal", "mom", "presentation_outline", "poc_brief")
LEGACY_CURRENT_TEMPLATES = (("Quotation", "quotation"), ("Cost Projection", "cost_projection"))


def is_adoptable_default_template(template, template_type, name, variables, content):
    canonical = (
        template.name == name
        and template.type == template_type
        and template.description == f"LLM-assisted {name}"
        and template.content_template == content
        and template.variables == variables
    )
    legacy_name, legacy_variables, legacy_content = LEGACY_TEMPLATES.get(template_type, (None, None, None))
    legacy = (
        (name, template_type) in LEGACY_CURRENT_TEMPLATES
        and template.name == legacy_name
        and template.type == template_type
        and template.description == f"Deterministic {legacy_name} template"
        and template.content_template == legacy_content
        and template.variables == legacy_variables
    )
    return template.external_source is None and (canonical or legacy)


def ensure_default_templates(workspace):
    for template_type in RETIRED_TEMPLATE_TYPES:
        name, variables, content = LEGACY_TEMPLATES[template_type]
        AutomationTemplate.objects.filter(
            workspace=workspace,
            name=name,
            type=template_type,
            description=f"Deterministic {name} template",
            content_template=content,
            variables=variables,
            external_source__isnull=True,
        ).update(is_active=False)
    for template_type, (name, variables, content) in DEFAULT_TEMPLATES.items():
        external_id = f"template:{template_type}"
        if AutomationTemplate.objects.filter(
            workspace=workspace,
            external_source=SYSTEM_TEMPLATE_SOURCE,
            external_id=external_id,
        ).exists():
            continue
        existing = AutomationTemplate.objects.filter(workspace=workspace, name=name).first()
        if existing:
            if is_adoptable_default_template(existing, template_type, name, variables, content):
                update_fields = ["external_source", "external_id", "updated_at"]
                if existing.content_template != content:
                    existing.description = f"LLM-assisted {name}"
                    existing.content_template = content
                    existing.variables = variables
                    existing.is_active = True
                    update_fields.extend(["description", "content_template", "variables", "is_active"])
                existing.external_source = SYSTEM_TEMPLATE_SOURCE
                existing.external_id = external_id
                existing.save(update_fields=update_fields)
            continue
        AutomationTemplate.objects.create(
            workspace=workspace,
            name=name,
            type=template_type,
            description=f"LLM-assisted {name}",
            content_template=content,
            variables=variables,
            is_active=True,
            external_source=SYSTEM_TEMPLATE_SOURCE,
            external_id=external_id,
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


def _lock_authorized_job(job, actor, action):
    job = (
        AutomationJob.objects.select_for_update().filter(id=job.id, workspace=job.workspace, requested_by=actor).first()
    )
    if not job:
        raise Http404
    if not job.project_id:
        raise serializers.ValidationError(
            {"error_code": "project_required", "project": f"Select an authorized Plane Project before {action}."}
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
                "project": f"Active Plane Project membership is required to {action} this preview.",
            }
        )
    return job


def _job_title(job):
    fallback = job.template.name if job.template else job.type
    return str(job.input.get("values", {}).get("title") or fallback).strip()[:255]


def _require_completed_preview(job, action):
    if job.status != AutomationJob.Status.COMPLETED or not job.preview_markdown:
        raise serializers.ValidationError({"job": f"Only a completed preview can be {action}."})


def render_job_files(job, actor):
    with transaction.atomic():
        job = _lock_authorized_job(job, actor, "render")
        _require_completed_preview(job, "rendered")
        existing_formats = set(job.artifacts.filter(deleted_at__isnull=True).values_list("format", flat=True))
        title, document_type, markdown = _job_title(job), job.type, job.preview_markdown
    try:
        rendered_files = render_document_files(document_type, title, markdown)
    except ValueError as error:
        raise serializers.ValidationError(
            {"error_code": "unsupported_document_type", "type": "This automation type cannot be rendered."}
        ) from error

    staged, kept = [], set()
    try:
        for rendered in rendered_files:
            if rendered.format in existing_formats:
                continue
            attributes = {"name": rendered.filename, "type": rendered.content_type, "size": len(rendered.data)}
            asset = FileAsset(
                workspace=job.workspace,
                project=job.project,
                user=actor,
                entity_type="SUMMON_GENERATED",
                entity_identifier=str(job.id),
                attributes=attributes,
                size=len(rendered.data),
                is_uploaded=True,
            )
            asset.asset.name = asset.asset.field.generate_filename(asset, rendered.filename)
            staged.append((rendered, asset))
            asset.asset.name = asset.asset.storage.save(asset.asset.name, ContentFile(rendered.data))

        reserved = []
        with transaction.atomic():
            job = _lock_authorized_job(job, actor, "render")
            _require_completed_preview(job, "rendered")
            for rendered, asset in staged:
                if job.artifacts.filter(format=rendered.format, deleted_at__isnull=True).exists():
                    continue
                asset.save()
                GeneratedArtifact.objects.create(
                    workspace=job.workspace,
                    job=job,
                    project=job.project,
                    file_asset=asset,
                    title=title,
                    kind=job.type,
                    format=rendered.format,
                )
                reserved.append(asset.asset.name)
        kept = set(reserved)
        return job
    finally:
        for _, asset in staged:
            if asset.asset.name and asset.asset.name not in kept:
                asset.asset.storage.delete(asset.asset.name)


def authorize_artifact_download(artifact, actor):
    with transaction.atomic():
        artifact = (
            GeneratedArtifact.objects.select_for_update()
            .select_related("job", "file_asset")
            .filter(id=artifact.id, workspace=artifact.workspace, job__requested_by=actor, file_asset__isnull=False)
            .first()
        )
        if not artifact:
            raise Http404
        _lock_authorized_job(artifact.job, actor, "download")
        return artifact


def publish_job(job, actor):
    with transaction.atomic():
        job = _lock_authorized_job(job, actor, "publish")
        artifact = job.artifacts.select_related("page").filter(format=GeneratedArtifact.Format.PAGE).first()
        if artifact:
            return artifact
        _require_completed_preview(job, "published")

        title = _job_title(job)
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
            format=GeneratedArtifact.Format.PAGE,
        )
        job.published_at = timezone.now()
        job.save(update_fields=["published_at", "updated_at"])
        return artifact
