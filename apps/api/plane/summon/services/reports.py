# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone

from plane.db.models import FileAsset, Issue, Page, ProjectMember
from plane.summon.models import AutomationJob, Client, Meeting, Opportunity


def visible_project_ids(workspace, user):
    return ProjectMember.objects.filter(
        workspace=workspace,
        project__deleted_at__isnull=True,
        member=user,
        is_active=True,
    ).values_list("project_id", flat=True)


def report_summary(workspace, user):
    project_ids = visible_project_ids(workspace, user)
    issues = Issue.objects.filter(workspace=workspace, project_id__in=project_ids)
    opportunities = Opportunity.objects.filter(workspace=workspace)
    pipeline_value = opportunities.exclude(stage__in=["won", "lost"]).aggregate(total=Sum("value"))["total"]
    overdue = issues.filter(target_date__lt=timezone.now().date()).exclude(state__group__in=["completed", "cancelled"])
    pages = Page.objects.filter(workspace=workspace).filter(
        Q(owned_by=user)
        | Q(access=Page.PUBLIC_ACCESS, is_global=True)
        | Q(access=Page.PUBLIC_ACCESS, projects__id__in=project_ids)
    )
    assets = FileAsset.objects.filter(workspace=workspace, is_deleted=False).filter(
        Q(project__isnull=True) | Q(project_id__in=project_ids)
    )
    jobs = AutomationJob.objects.filter(workspace=workspace).filter(
        Q(project__isnull=True) | Q(project_id__in=project_ids)
    )
    return {
        "projects": project_ids.distinct().count(),
        "issues": {
            "total": issues.count(),
            "completed": issues.filter(state__group="completed").count(),
            "overdue": overdue.count(),
        },
        "commercial": {
            "clients": Client.objects.filter(workspace=workspace).count(),
            "opportunities": opportunities.count(),
            "pipeline_value": f"{pipeline_value or Decimal('0'):.2f}",
        },
        "knowledge": {"pages": pages.distinct().count(), "files": assets.count()},
        "meetings": Meeting.objects.filter(workspace=workspace)
        .filter(Q(project__isnull=True) | Q(project_id__in=project_ids))
        .count(),
        "automation": {
            "jobs": jobs.count(),
            "completed": jobs.filter(status=AutomationJob.Status.COMPLETED).count(),
        },
    }
