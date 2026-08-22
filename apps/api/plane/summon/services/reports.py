# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import csv
import io
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from plane.db.models import FileAsset, Issue, IssueActivity, Page, Project, ProjectMember
from plane.summon.models import AutomationJob, Client, Meeting, Opportunity, SummonProjectProfile


def visible_project_ids(workspace, user):
    return ProjectMember.objects.filter(
        workspace=workspace,
        project__deleted_at__isnull=True,
        member=user,
        is_active=True,
    ).values_list("project_id", flat=True)


def _in_date_range(queryset, filters, field="created_at"):
    if date_from := filters.get("date_from"):
        queryset = queryset.filter(**{f"{field}__date__gte": date_from})
    if date_to := filters.get("date_to"):
        queryset = queryset.filter(**{f"{field}__date__lte": date_to})
    return queryset


def _count_series(queryset, field, value="count"):
    return list(
        queryset.annotate(date=TruncDate(field)).values("date").annotate(**{value: Count("id")}).order_by("date")
    )


def _report(workspace, user, filters):
    scoped = bool(filters.get("project_id") or filters.get("client_id"))
    scope_projects = Project.objects.filter(workspace=workspace, id__in=visible_project_ids(workspace, user))
    if project_id := filters.get("project_id"):
        scope_projects = scope_projects.filter(id=project_id)
    if client_id := filters.get("client_id"):
        scope_projects = scope_projects.filter(summon_profiles__client_id=client_id)
    scope_projects = scope_projects.distinct()
    projects = _in_date_range(scope_projects, filters)
    project_ids = list(scope_projects.values_list("id", flat=True))
    project_client_ids = SummonProjectProfile.objects.filter(
        workspace=workspace,
        project_id__in=project_ids,
        client_id__isnull=False,
    ).values_list("client_id", flat=True)

    clients = Client.objects.filter(workspace=workspace)
    opportunities = Opportunity.objects.filter(workspace=workspace)
    if client_id := filters.get("client_id"):
        clients = clients.filter(id=client_id)
        opportunities = opportunities.filter(client_id=client_id)
    elif filters.get("project_id"):
        clients = clients.filter(id__in=project_client_ids)
        opportunities = opportunities.filter(client_id__in=project_client_ids)
    clients = _in_date_range(clients, filters)
    opportunities = _in_date_range(opportunities, filters)

    issues = _in_date_range(
        Issue.objects.filter(workspace=workspace, project_id__in=project_ids).select_related("project", "state"),
        filters,
    )
    pages = Page.objects.filter(workspace=workspace).filter(
        Q(owned_by=user)
        | Q(access=Page.PUBLIC_ACCESS, is_global=True)
        | Q(access=Page.PUBLIC_ACCESS, projects__id__in=project_ids)
    )
    assets = FileAsset.objects.filter(workspace=workspace, is_deleted=False)
    meetings = Meeting.objects.filter(workspace=workspace)
    jobs = AutomationJob.objects.filter(workspace=workspace)
    if scoped:
        pages = pages.filter(projects__id__in=project_ids)
        assets = assets.filter(project_id__in=project_ids)
        meetings = meetings.filter(project_id__in=project_ids)
        jobs = jobs.filter(project_id__in=project_ids)
    else:
        assets = assets.filter(Q(project__isnull=True) | Q(project_id__in=project_ids))
        meetings = meetings.filter(Q(project__isnull=True) | Q(project_id__in=project_ids))
        jobs = jobs.filter(Q(project__isnull=True) | Q(project_id__in=project_ids))
    pages = _in_date_range(pages.distinct(), filters)
    assets = _in_date_range(assets, filters)
    meetings = _in_date_range(meetings, filters, "starts_at")
    jobs = _in_date_range(jobs, filters)
    activity = _in_date_range(
        IssueActivity.objects.filter(workspace=workspace, project_id__in=project_ids)
        .select_related("issue")
        .exclude(issue__isnull=True),
        filters,
    )

    issue_counts = issues.aggregate(
        total=Count("id"),
        completed=Count("id", filter=Q(state__group="completed")),
        overdue=Count(
            "id",
            filter=Q(target_date__lt=timezone.now().date()) & ~Q(state__group__in=["completed", "cancelled"]),
        ),
    )
    pipeline_value = opportunities.exclude(stage__in=[Opportunity.Stage.WON, Opportunity.Stage.LOST]).aggregate(
        total=Sum("value")
    )["total"]
    project_issue_counts = {
        item["project_id"]: item
        for item in issues.values("project_id").annotate(
            total=Count("id"),
            completed=Count("id", filter=Q(state__group="completed")),
        )
    }
    profiles = {
        profile.project_id: profile
        for profile in SummonProjectProfile.objects.filter(workspace=workspace, project_id__in=project_ids)
    }
    project_health = [
        {
            "project_id": str(project.id),
            "name": project.name,
            "health": (
                profiles[project.id].health if project.id in profiles else SummonProjectProfile.ProjectHealth.ON_TRACK
            ),
            "completion": (
                round(project_issue_counts[project.id]["completed"] / project_issue_counts[project.id]["total"] * 100)
                if project.id in project_issue_counts and project_issue_counts[project.id]["total"]
                else 0
            ),
        }
        for project in projects.order_by("name")
    ]

    opportunity_counts = {
        item["stage"]: item for item in opportunities.values("stage").annotate(count=Count("id"), value=Sum("value"))
    }
    opportunity_stages = [
        {
            "stage": stage,
            "count": opportunity_counts.get(stage, {}).get("count", 0),
            "value": f"{opportunity_counts.get(stage, {}).get('value') or Decimal('0'):.2f}",
        }
        for stage in Opportunity.Stage.values
    ]
    today = timezone.now().date()
    active_issues = issues.exclude(state__group__in=["completed", "cancelled"])
    due_date_buckets = [
        {"label": "Overdue", "count": active_issues.filter(target_date__lt=today).count()},
        {
            "label": "Due in 7 days",
            "count": active_issues.filter(target_date__range=(today, today + timedelta(days=7))).count(),
        },
        {"label": "Later", "count": active_issues.filter(target_date__gt=today + timedelta(days=7)).count()},
        {"label": "No due date", "count": active_issues.filter(target_date__isnull=True).count()},
    ]
    completion_trend = _count_series(
        issues.filter(state__group="completed", completed_at__isnull=False),
        "completed_at",
        "completed",
    )
    meeting_counts = {item["status"]: item["count"] for item in meetings.values("status").annotate(count=Count("id"))}
    meeting_statuses = [
        {"status": meeting_status, "count": meeting_counts.get(meeting_status, 0)}
        for meeting_status in Meeting.Status.values
    ]
    automation_counts = {item["status"]: item["count"] for item in jobs.values("status").annotate(count=Count("id"))}
    automation_statuses = [
        {"status": job_status, "count": automation_counts.get(job_status, 0)}
        for job_status in AutomationJob.Status.values
    ]
    recent_activity = [
        {
            "id": str(item.id),
            "label": f"{item.issue.name}: {item.verb}",
            "created_at": item.created_at,
            "href": f"/{workspace.slug}/projects/{item.project_id}/issues/{item.issue_id}/",
        }
        for item in activity.order_by("-created_at")[:20]
    ]
    summary = {
        "projects": projects.count(),
        "issues": issue_counts,
        "commercial": {
            "clients": clients.count(),
            "opportunities": opportunities.count(),
            "pipeline_value": f"{pipeline_value or Decimal('0'):.2f}",
        },
        "project_health": project_health,
        "opportunity_stages": opportunity_stages,
        "due_date_buckets": due_date_buckets,
        "completion_trend": completion_trend,
        "knowledge": {"pages": pages.count(), "files": assets.count()},
        "meetings": meetings.count(),
        "meeting_statuses": meeting_statuses,
        "meeting_trend": _count_series(meetings, "starts_at"),
        "automation": {
            "jobs": jobs.count(),
            "completed": automation_counts.get(AutomationJob.Status.COMPLETED, 0),
            "failed": automation_counts.get(AutomationJob.Status.FAILED, 0),
        },
        "automation_statuses": automation_statuses,
        "automation_usage": _count_series(jobs, "created_at"),
        "recent_activity": recent_activity,
    }
    csv_rows = [
        ("Portfolio", "Projects", summary["projects"]),
        ("Delivery", "Issues", issue_counts["total"]),
        ("Delivery", "Completed", issue_counts["completed"]),
        ("Delivery", "Overdue", issue_counts["overdue"]),
        ("Commercial", "Clients", summary["commercial"]["clients"]),
        ("Commercial", "Opportunities", summary["commercial"]["opportunities"]),
        ("Commercial", "Pipeline value", summary["commercial"]["pipeline_value"]),
        ("Knowledge", "Pages", summary["knowledge"]["pages"]),
        ("Knowledge", "Files", summary["knowledge"]["files"]),
        ("Meetings", "Total", summary["meetings"]),
        ("Automation", "Jobs", summary["automation"]["jobs"]),
    ]
    csv_rows.extend(("Project health", item["name"], item["health"]) for item in project_health)
    csv_rows.extend(("Client", client.name, client.status) for client in clients.order_by("name"))
    csv_rows.extend(("Opportunity stage", item["stage"], item["value"]) for item in opportunity_stages)
    csv_rows.extend(("Recent activity", item["label"], item["created_at"]) for item in recent_activity)
    return summary, csv_rows


def report_summary(workspace, user, filters=None):
    return _report(workspace, user, filters or {})[0]


def csv_cell(value):
    text = "" if value is None else str(value)
    return f"'{text}" if text.lstrip(" \t\r\n").startswith(("=", "+", "-", "@")) else text


def report_csv(workspace, user, filters=None):
    _, rows = _report(workspace, user, filters or {})
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Section", "Label", "Value"])
    writer.writerows([csv_cell(value) for value in row] for row in rows)
    return output.getvalue()
