import re

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from plane.db.models import Project, ProjectMember
from plane.summon.models import (
    AssistantAction,
    AssistantAttachment,
    AssistantMessage,
    AutomationJob,
    AutomationTemplate,
)
from plane.summon.services.assistant_attachment import attachment_context_entries
from plane.summon.services.automation import generate_preview, render_job_files
from plane.summon.services.automation_templates import refresh_default_templates
from plane.summon.services.reports import visible_project_ids

DOCUMENT_TOOL = "summon_document"
GENERATION_VERBS = {"buat", "buatkan", "create", "generate", "hasilkan", "susun"}
DOCUMENT_WORDS = {
    "bast",
    "document",
    "dokumen",
    "file",
    "invoice",
    "laporan",
    "mom",
    "presentation",
    "presentasi",
    "proposal",
    "quotation",
    "timeline",
    "uat",
}


def _normalize(value):
    return " ".join(re.sub(r"[^a-z0-9]+", " ", value.casefold()).split())


def _templates(workspace):
    refresh_default_templates(workspace)
    return list(AutomationTemplate.objects.filter(workspace=workspace, is_active=True).order_by("name"))


def _match_template(content, templates, allow_alias=True):
    normalized = _normalize(content)
    for template in templates:
        if normalized in {_normalize(template.name), _normalize(template.type)}:
            return template
    for template in templates:
        name = _normalize(template.name)
        template_type = _normalize(template.type)
        if f" {name} " in f" {normalized} " or f" {template_type} " in f" {normalized} ":
            return template
    if allow_alias and ("mom" in normalized.split() or "minutes of meeting" in normalized):
        preferred = "mom_iglo" if "iglo" in normalized else "mom_summon"
        return next((item for item in templates if item.type == preferred), None)
    return None


def _is_document_request(content, template):
    if template:
        return True
    words = set(_normalize(content).split())
    return bool(words & GENERATION_VERBS and words & DOCUMENT_WORDS)


def _project(conversation, actor, selection):
    project_id = selection.get("project_id") or conversation.project_id
    return Project.objects.filter(
        id=project_id,
        workspace=conversation.workspace,
        deleted_at__isnull=True,
        id__in=visible_project_ids(conversation.workspace, actor),
    ).first()


def _source_attachments(conversation):
    return list(
        AssistantAttachment.objects.filter(
            conversation=conversation,
            status=AssistantAttachment.Status.READY,
        ).order_by("created_at")
    )


def _preview(content, template, templates, project, sources):
    return {
        "state": "confirm" if template else "choose_template",
        "title": "Generate document",
        "summary": content,
        "template": ({"id": str(template.id), "name": template.name, "type": template.type} if template else None),
        "template_options": [{"id": str(item.id), "name": item.name, "type": item.type} for item in templates],
        "project": {"id": str(project.id), "name": project.name} if project else None,
        "sources": [{"id": str(item.id), "name": item.original_name, "status": item.status} for item in sources],
        "formats": ["pdf", "docx"],
    }


def select_document_template(action, template_id):
    if action.tool != DOCUMENT_TOOL or action.status != AssistantAction.Status.PENDING:
        raise serializers.ValidationError({"action": "Only a pending document action can select a template."})
    template = AutomationTemplate.objects.filter(
        id=template_id,
        workspace=action.workspace,
        is_active=True,
    ).first()
    if not template:
        raise serializers.ValidationError({"template_id": "Select an active workspace template."})
    action.arguments = {**action.arguments, "template_id": str(template.id)}
    action.preview = {
        **action.preview,
        "state": "confirm",
        "template": {"id": str(template.id), "name": template.name, "type": template.type},
    }
    action.save(update_fields=["arguments", "preview", "updated_at"])
    return action


def handle_document_message(conversation, actor, content, selection, attachment_ids):
    templates = _templates(conversation.workspace)
    pending = conversation.actions.filter(
        requester=actor,
        tool=DOCUMENT_TOOL,
        status=AssistantAction.Status.PENDING,
        preview__state="choose_template",
    ).last()
    selected = _match_template(content, templates, allow_alias=False)
    if pending and selected:
        user_message = AssistantMessage.objects.create(
            conversation=conversation,
            workspace=conversation.workspace,
            role=AssistantMessage.Role.USER,
            content=content,
        )
        action = select_document_template(pending, selected.id)
        assistant_message = AssistantMessage.objects.create(
            conversation=conversation,
            workspace=conversation.workspace,
            role=AssistantMessage.Role.ASSISTANT,
            content=f"Confirm generation of {selected.name}.",
            provider="summon-document-preview",
        )
        return user_message, assistant_message, action

    template = _match_template(content, templates)
    if not _is_document_request(content, template):
        return None

    with transaction.atomic():
        requested = list(
            AssistantAttachment.objects.select_for_update().filter(
                id__in=attachment_ids,
                conversation=conversation,
                conversation__owner=actor,
                message__isnull=True,
                status=AssistantAttachment.Status.READY,
            )
        )
        if len(requested) != len(attachment_ids):
            raise serializers.ValidationError({"attachment_ids": "Only ready attachments can generate documents."})
        user_message = AssistantMessage.objects.create(
            conversation=conversation,
            workspace=conversation.workspace,
            role=AssistantMessage.Role.USER,
            content=content,
        )
        if requested:
            AssistantAttachment.objects.filter(id__in=[item.id for item in requested]).update(message=user_message)
        sources = _source_attachments(conversation)
        project = _project(conversation, actor, selection)
        preview = _preview(content, template, templates, project, sources)
        action = AssistantAction.objects.create(
            workspace=conversation.workspace,
            conversation=conversation,
            requester=actor,
            tool=DOCUMENT_TOOL,
            arguments={
                "request": content,
                "template_id": str(template.id) if template else None,
                "project_id": str(project.id) if project else None,
                "attachment_ids": [str(item.id) for item in sources],
                "context": {**selection, "project_id": str(project.id) if project else None},
                "formats": ["pdf", "docx"],
            },
            preview=preview,
        )
        assistant_message = AssistantMessage.objects.create(
            conversation=conversation,
            workspace=conversation.workspace,
            role=AssistantMessage.Role.ASSISTANT,
            content=(
                f"Confirm generation of {template.name}." if template else "Choose the document type to generate."
            ),
            provider="summon-document-preview",
        )
    conversation.last_activity_at = timezone.now()
    conversation.save(update_fields=["last_activity_at", "updated_at"])
    return user_message, assistant_message, action


def _validated_generation_inputs(action):
    template = AutomationTemplate.objects.filter(
        id=action.arguments.get("template_id"),
        workspace=action.workspace,
        is_active=True,
    ).first()
    if not template:
        raise serializers.ValidationError({"template_id": "Select an active workspace template."})
    project = Project.objects.filter(
        id=action.arguments.get("project_id"),
        workspace=action.workspace,
        deleted_at__isnull=True,
    ).first()
    if not project:
        raise serializers.ValidationError({"error_code": "project_required", "project": "Select a Plane Project."})
    if not ProjectMember.objects.filter(
        workspace=action.workspace,
        project=project,
        member=action.requester,
        role__in=[20, 15],
        is_active=True,
    ).exists():
        raise serializers.ValidationError({"error_code": "project_access_revoked"})
    attachment_ids = action.arguments.get("attachment_ids", [])
    attachments = list(
        AssistantAttachment.objects.filter(
            id__in=attachment_ids,
            conversation=action.conversation,
            conversation__owner=action.requester,
            status=AssistantAttachment.Status.READY,
        )
    )
    if len(attachments) != len(attachment_ids):
        raise serializers.ValidationError({"attachment_ids": "All source files must be ready and authorized."})
    return template, project, attachments


def execute_document_action(action, retry=False):
    if action.tool != DOCUMENT_TOOL or action.requester_id != action.conversation.owner_id:
        raise serializers.ValidationError({"action": "Invalid document action."})
    template, project, attachments = _validated_generation_inputs(action)
    existing = None
    if action.result.get("automation_job_id"):
        existing = AutomationJob.objects.filter(
            id=action.result["automation_job_id"],
            workspace=action.workspace,
            requested_by=action.requester,
            template=template,
            project=project,
        ).first()
        if not existing:
            raise serializers.ValidationError({"action": "Generated job is unavailable."})
        if existing.status == AutomationJob.Status.RUNNING:
            raise serializers.ValidationError({"action": "Document generation is already running."})
        if not retry:
            return existing
    source_names = [item.original_name for item in attachments]
    job = generate_preview(
        template,
        project,
        action.requester,
        {"title": template.name, "instructions": action.arguments["request"], "source_files": source_names},
        action.arguments.get("context", {}),
        source_entries=attachment_context_entries(
            action.conversation,
            action.requester,
            attachment_ids=action.arguments.get("attachment_ids", []),
        ),
        job=existing,
    )
    if job.status == AutomationJob.Status.COMPLETED:
        try:
            render_job_files(job, action.requester)
        except Exception:
            job.status = AutomationJob.Status.FAILED
            job.error_summary = "document_render_failed"
            job.save(update_fields=["status", "error_summary", "updated_at"])
    result_message = AssistantMessage.objects.filter(automation_job=job).first()
    if not result_message:
        result_message = AssistantMessage(
            conversation=action.conversation,
            workspace=action.workspace,
            role=AssistantMessage.Role.ASSISTANT,
            automation_job=job,
        )
    result_message.content = (
        f"{template.name} is ready to preview and download."
        if job.status == AutomationJob.Status.COMPLETED
        else f"Document generation failed: {job.error_summary}."
    )
    result_message.citations = job.input.get("citations", [])
    result_message.status = (
        AssistantMessage.Status.COMPLETED
        if job.status == AutomationJob.Status.COMPLETED
        else AssistantMessage.Status.FAILED
    )
    result_message.provider = job.provider
    result_message.model = job.model
    result_message.save()
    return job
