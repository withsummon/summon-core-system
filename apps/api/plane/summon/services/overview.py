# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Count, Q
from django.utils import timezone

from plane.db.models import Cycle, FileAsset, Issue, IssueActivity, Module, Page, Project
from plane.summon.models import Client, Meeting, Opportunity, ResourceLink, SummonProjectProfile
from plane.summon.services.reports import visible_project_ids


def _progress(issues):
    counts = issues.aggregate(
        total=Count("id"),
        completed=Count("id", filter=Q(state__group="completed")),
        overdue=Count(
            "id",
            filter=Q(target_date__lt=timezone.now().date()) & ~Q(state__group__in=["completed", "cancelled"]),
        ),
    )
    total = counts["total"]
    return {**counts, "percentage": round((counts["completed"] / total) * 100) if total else 0}


def _issue_snapshot(issue):
    state = issue.state
    return {
        "id": str(issue.id),
        "name": issue.name,
        "sequence_id": issue.sequence_id,
        "project": {
            "id": str(issue.project_id),
            "identifier": issue.project.identifier,
            "name": issue.project.name,
        },
        "state": {"id": str(state.id), "name": state.name, "group": state.group} if state else None,
        "completed": bool(state and state.group == "completed"),
    }


def _profile_snapshot(profile):
    if not profile:
        return None
    return {
        "id": str(profile.id),
        "project": str(profile.project_id),
        "client": str(profile.client_id) if profile.client_id else None,
        "source_opportunity": str(profile.source_opportunity_id) if profile.source_opportunity_id else None,
        "delivery_status": profile.delivery_status,
        "phase": profile.phase,
        "health": profile.health,
        "start_date": profile.start_date.isoformat() if profile.start_date else None,
        "target_date": profile.target_date.isoformat() if profile.target_date else None,
        "budget": str(profile.budget) if profile.budget is not None else None,
    }


def _file_snapshot(asset):
    return {
        "id": str(asset.id),
        "name": asset.attributes.get("name", ""),
        "content_type": asset.attributes.get("type", ""),
        "size": asset.size,
        "entity_type": asset.entity_type,
        "url": asset.asset_url,
        "created_at": asset.created_at.isoformat().replace("+00:00", "Z"),
    }


def _meeting_snapshot(meeting, visible_ids):
    return {
        "id": str(meeting.id),
        "title": meeting.title,
        "agenda": meeting.agenda,
        "notes": meeting.notes,
        "location": meeting.location,
        "meeting_url": meeting.meeting_url,
        "status": meeting.status,
        "starts_at": meeting.starts_at,
        "ends_at": meeting.ends_at,
        "project": str(meeting.project_id) if meeting.project_id else None,
        "project_detail": (
            {"id": str(meeting.project_id), "identifier": meeting.project.identifier, "name": meeting.project.name}
            if meeting.project_id
            else None
        ),
        "recording_asset": str(meeting.recording_asset_id) if meeting.recording_asset_id else None,
        "recording_asset_detail": (
            {"id": str(meeting.recording_asset_id), "name": meeting.recording_asset.attributes.get("name", "")}
            if meeting.recording_asset_id
            else None
        ),
        "transcript_asset": str(meeting.transcript_asset_id) if meeting.transcript_asset_id else None,
        "transcript_asset_detail": (
            {"id": str(meeting.transcript_asset_id), "name": meeting.transcript_asset.attributes.get("name", "")}
            if meeting.transcript_asset_id
            else None
        ),
        "summary_page": str(meeting.summary_page_id) if meeting.summary_page_id else None,
        "summary_page_detail": (
            {"id": str(meeting.summary_page_id), "name": meeting.summary_page.name} if meeting.summary_page_id else None
        ),
        "participants": [
            {
                "id": str(participant.id),
                "member": {"id": str(participant.member_id), "display_name": participant.member.display_name},
                "response": participant.response,
            }
            for participant in meeting.participants.all()
        ],
        "work_items": [
            {"id": str(item.id), "issue": _issue_snapshot(item.issue), "created_at": item.created_at}
            for item in meeting.work_items.all()
            if item.issue.project_id in visible_ids
        ],
    }


def _resource_snapshot(resource):
    return {
        "id": str(resource.id),
        "project": str(resource.project_id) if resource.project_id else None,
        "page": str(resource.page_id) if resource.page_id else None,
        "client": str(resource.client_id) if resource.client_id else None,
        "credential": str(resource.credential_id) if resource.credential_id else None,
        "title": resource.title,
        "url": resource.url,
        "description": resource.description,
        "category": resource.category,
        "created_at": resource.created_at,
        "updated_at": resource.updated_at,
    }


def _accessible_pages(workspace, user, project_ids):
    return Page.objects.filter(workspace=workspace).filter(
        Q(owned_by=user)
        | Q(access=Page.PUBLIC_ACCESS, is_global=True)
        | Q(access=Page.PUBLIC_ACCESS, projects__id__in=project_ids)
    )


def _meetings(workspace, visible_ids, project=None):
    meetings = (
        Meeting.objects.filter(workspace=workspace, project=project)
        if project
        else Meeting.objects.filter(workspace=workspace).filter(Q(project__isnull=True) | Q(project_id__in=visible_ids))
    )
    return [
        _meeting_snapshot(meeting, visible_ids)
        for meeting in meetings.select_related(
            "project", "recording_asset", "transcript_asset", "summary_page"
        ).prefetch_related("participants__member", "work_items__issue__state", "work_items__issue__project")
    ]


def _activity(workspace, project_ids, slug, project=None):
    activity = IssueActivity.objects.filter(workspace=workspace, project_id__in=project_ids)
    if project:
        activity = activity.filter(project=project)
    return [
        {
            "id": str(item.id),
            "label": f"{item.issue.name}: {item.verb}",
            "created_at": item.created_at,
            "href": f"/{slug}/projects/{item.project_id}/issues/{item.issue_id}/",
        }
        for item in activity.select_related("issue").exclude(issue__isnull=True).order_by("-created_at")[:20]
    ]


def _milestones(project, slug):
    modules = Module.objects.filter(project=project, archived_at__isnull=True).annotate(
        total=Count("issue_module"),
        completed=Count("issue_module", filter=Q(issue_module__issue__state__group="completed")),
    )
    cycles = Cycle.objects.filter(project=project, archived_at__isnull=True).annotate(
        total=Count("issue_cycle"),
        completed=Count("issue_cycle", filter=Q(issue_cycle__issue__state__group="completed")),
    )
    return [
        {
            "id": str(item.id),
            "name": item.name,
            "target_date": item.target_date,
            "completion": round((item.completed / item.total) * 100) if item.total else 0,
            "href": f"/{slug}/projects/{project.id}/modules/{item.id}/",
        }
        for item in modules
    ] + [
        {
            "id": str(item.id),
            "name": item.name,
            "target_date": item.end_date,
            "completion": round((item.completed / item.total) * 100) if item.total else 0,
            "href": f"/{slug}/projects/{project.id}/cycles/{item.id}/",
        }
        for item in cycles
    ]


def home_summary(workspace, user):
    visible_ids = list(visible_project_ids(workspace, user))
    projects = list(Project.objects.filter(workspace=workspace, id__in=visible_ids).order_by("name"))
    profiles = {
        profile.project_id: profile
        for profile in SummonProjectProfile.objects.filter(workspace=workspace, project_id__in=visible_ids)
    }
    issues = Issue.objects.filter(workspace=workspace, project_id__in=visible_ids).select_related("project", "state")
    accessible_pages = _accessible_pages(workspace, user, visible_ids)
    resources = (
        ResourceLink.objects.filter(workspace=workspace)
        .filter(Q(project__isnull=True) | Q(project_id__in=visible_ids))
        .filter(Q(page__isnull=True) | Q(page__in=accessible_pages))
    )
    project_counts = {
        item["project_id"]: item
        for item in issues.values("project_id").annotate(
            total=Count("id"), completed=Count("id", filter=Q(state__group="completed"))
        )
    }
    priority = (
        issues.filter(target_date__lte=timezone.now().date())
        .exclude(state__group__in=["completed", "cancelled"])
        .order_by("target_date", "created_at")[:20]
    )
    return {
        "priority": [_issue_snapshot(issue) for issue in priority],
        "projects": [
            {
                "id": str(project.id),
                "identifier": project.identifier,
                "name": project.name,
                "health": profiles.get(project.id).health if project.id in profiles else "on_track",
                "completion": round(
                    (project_counts[project.id]["completed"] / project_counts[project.id]["total"]) * 100
                )
                if project.id in project_counts and project_counts[project.id]["total"]
                else 0,
            }
            for project in projects
        ],
        "counts": {
            "projects": len(projects),
            "issues": issues.count(),
            "clients": Client.objects.filter(workspace=workspace).count(),
            "opportunities": Opportunity.objects.filter(workspace=workspace).count(),
        },
        "recent_activity": _activity(workspace, visible_ids, workspace.slug),
        "upcoming_meetings": [
            meeting
            for meeting in _meetings(workspace, visible_ids)
            if meeting["starts_at"] >= timezone.now() and meeting["status"] == Meeting.Status.SCHEDULED
        ],
        "resources": [_resource_snapshot(resource) for resource in resources],
    }


def project_overview(workspace, user, project_id):
    visible_ids = list(visible_project_ids(workspace, user))
    project = Project.objects.filter(workspace=workspace, id=project_id, id__in=visible_ids).first()
    if not project:
        return None
    issues = Issue.objects.filter(workspace=workspace, project=project).select_related("project", "state")
    pages = _accessible_pages(workspace, user, visible_ids).filter(projects=project).distinct()
    resources = ResourceLink.objects.filter(workspace=workspace, project=project).filter(
        Q(page__isnull=True) | Q(page__in=pages)
    )
    profile = SummonProjectProfile.objects.filter(workspace=workspace, project=project).first()
    files = FileAsset.objects.filter(
        workspace=workspace,
        project=project,
        is_uploaded=True,
        is_deleted=False,
        is_archived=False,
    ).exclude(entity_type=FileAsset.EntityTypeContext.PROJECT_COVER)
    return {
        "project": {
            "id": str(project.id),
            "identifier": project.identifier,
            "name": project.name,
            "description": project.description,
        },
        "profile": _profile_snapshot(profile),
        "progress": _progress(issues),
        "milestones": _milestones(project, workspace.slug),
        "issues": [_issue_snapshot(issue) for issue in issues.order_by("-created_at")[:20]],
        "pages": [
            {"id": str(page.id), "name": page.name, "href": f"/{workspace.slug}/projects/{project.id}/pages/{page.id}/"}
            for page in pages.order_by("-created_at")[:20]
        ],
        "meetings": _meetings(workspace, visible_ids, project),
        "resources": [_resource_snapshot(resource) for resource in resources.order_by("title")],
        "activity": _activity(workspace, visible_ids, workspace.slug, project),
        "files": [_file_snapshot(asset) for asset in files if asset.asset_url],
    }
