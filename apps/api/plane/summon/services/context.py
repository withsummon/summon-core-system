# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from dataclasses import dataclass

from django.db.models import Q

from plane.db.models import Project
from plane.summon.models import Client, Meeting
from plane.summon.services.commercial import accessible_pages
from plane.summon.services.reports import visible_project_ids


@dataclass(frozen=True)
class ContextBundle:
    text: str
    citations: list[dict[str, str]]
    truncated: bool


def cap_context(chunks, limit=30000):
    text = "\n\n".join(chunks)
    return text[:limit], len(text) > limit


def _cap_context_entries(entries, limit=30000):
    text = ""
    citations = []
    for index, (chunk, citation) in enumerate(entries):
        separator = "\n\n" if text else ""
        remaining = limit - len(text)
        addition = f"{separator}{chunk}"
        if len(addition) > remaining:
            addition = addition[:remaining]
            text += addition
            if citation and len(addition) > len(separator):
                citations.append(citation)
            return text, citations, True
        text += addition
        if citation:
            citations.append(citation)
        if index == len(entries) - 1:
            return text, citations, False
    return text, citations, False


def _citation(record, label, href, kind):
    return {"id": str(record.id), "label": label, "href": href, "kind": kind}


def build_context(workspace, user, selection):
    project_ids = list(visible_project_ids(workspace, user))
    project_id_set = set(project_ids)
    entries = []

    if selection.get("workspace"):
        entries.append((f"[Workspace]\nName: {workspace.name}", None))

    project = Project.objects.filter(
        workspace=workspace,
        id=selection.get("project_id"),
        id__in=project_ids,
    ).first()
    if project:
        entries.append(
            (
                f"[Project]\nName: {project.name}\nIdentifier: {project.identifier}\n"
                f"Description: {project.description}",
                _citation(
                    project,
                    project.name,
                    f"/{workspace.slug}/projects/{project.id}/issues/",
                    "project",
                ),
            )
        )

    client = Client.objects.filter(workspace=workspace, id=selection.get("client_id")).first()
    if client:
        entries.append(
            (
                "[Client]\n"
                f"Name: {client.name}\nCompany: {client.company_name}\n"
                f"Industry: {client.industry}\nNotes: {client.notes}",
                _citation(client, client.name, f"/{workspace.slug}/summon/clients/{client.id}/", "client"),
            )
        )

    meeting = (
        Meeting.objects.filter(workspace=workspace, id=selection.get("meeting_id"))
        .filter(Q(project__isnull=True) | Q(project_id__in=project_ids))
        .first()
    )
    if meeting:
        entries.append(
            (
                "[Meeting]\n"
                f"Title: {meeting.title}\nStarts at: {meeting.starts_at.isoformat()}\n"
                f"Agenda: {meeting.agenda}\nNotes: {meeting.notes}",
                _citation(meeting, meeting.title, f"/{workspace.slug}/summon/meetings/{meeting.id}/", "meeting"),
            )
        )

    requested_page_ids = selection.get("page_ids", [])
    pages = {
        page.id: page
        for page in accessible_pages(workspace, user, project_ids)
        .filter(id__in=requested_page_ids)
        .prefetch_related("projects")
        .distinct()
    }
    for page_id in requested_page_ids:
        page = pages.get(page_id)
        if not page:
            continue
        page_project = next((item for item in page.projects.all() if item.id in project_id_set), None)
        href = (
            f"/{workspace.slug}/projects/{page_project.id}/pages/{page.id}/"
            if page_project
            else f"/{workspace.slug}/summon/knowledge/"
        )
        entries.append(
            (
                f"[Page]\nName: {page.name}\nContent: {page.description_stripped or ''}",
                _citation(page, page.name, href, "page"),
            )
        )

    text, citations, truncated = _cap_context_entries(entries)
    return ContextBundle(text=text, citations=citations, truncated=truncated)
