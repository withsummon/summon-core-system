# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Q

from plane.db.models import IssueActivity, Page, Project
from plane.summon.models import Meeting, MeetingWorkItem, Opportunity, SummonPageContext, SummonProjectProfile
from plane.summon.services.reports import visible_project_ids


def transition_opportunity(opportunity: Opportunity, stage: str, actor, probability=None) -> Opportunity:
    opportunity.stage = stage
    opportunity.updated_by = actor
    update_fields = ["stage", "updated_by", "updated_at"]
    if probability is not None:
        opportunity.probability = probability
        update_fields.append("probability")
    opportunity.save(disable_auto_set_user=True, update_fields=update_fields)
    return opportunity


def visible_linked_projects(record, user, profile_field):
    project_ids = visible_project_ids(record.workspace, user)
    return Project.objects.filter(
        workspace=record.workspace,
        id__in=project_ids,
        summon_profiles__deleted_at__isnull=True,
        **{f"summon_profiles__{profile_field}": record},
    ).order_by("name")


def accessible_pages(workspace, user, project_ids):
    return Page.objects.filter(workspace=workspace).filter(
        Q(owned_by=user)
        | Q(access=Page.PUBLIC_ACCESS, is_global=True)
        | Q(access=Page.PUBLIC_ACCESS, projects__id__in=project_ids)
    )


def detail_page_contexts(record, user, field):
    project_ids = visible_project_ids(record.workspace, user)
    return (
        SummonPageContext.objects.filter(
            workspace=record.workspace,
            **{field: record},
            page__in=accessible_pages(record.workspace, user, project_ids),
        )
        .filter(Q(project__isnull=True) | Q(project_id__in=project_ids))
        .select_related("page", "project", "client", "opportunity")
        .distinct()
    )


def detail_meetings(record, user, profile_field):
    projects = visible_linked_projects(record, user, profile_field)
    project_ids = projects.values_list("id", flat=True)
    pages = accessible_pages(record.workspace, user, visible_project_ids(record.workspace, user))
    return (
        Meeting.objects.filter(workspace=record.workspace, project_id__in=project_ids)
        .filter(Q(summary_page__isnull=True) | Q(summary_page__in=pages))
        .select_related("project", "recording_asset", "transcript_asset", "summary_page")
        .prefetch_related("participants__member", "work_items__issue__state", "work_items__issue__project")
    )


def detail_work_items(opportunity, user):
    project_ids = visible_linked_projects(opportunity, user, "source_opportunity").values_list("id", flat=True)
    return MeetingWorkItem.objects.filter(
        meeting__workspace=opportunity.workspace,
        meeting__project_id__in=project_ids,
        issue__project_id__in=project_ids,
        issue__deleted_at__isnull=True,
    ).select_related("issue__state", "issue__project")


def detail_project_profile(opportunity, user):
    project_ids = visible_linked_projects(opportunity, user, "source_opportunity").values_list("id", flat=True)
    return SummonProjectProfile.objects.filter(
        workspace=opportunity.workspace,
        source_opportunity=opportunity,
        project_id__in=project_ids,
    ).first()


def detail_activity(record, user, profile_field):
    project_ids = visible_linked_projects(record, user, profile_field).values_list("id", flat=True)
    return [
        {
            "id": str(activity.id),
            "label": f"{activity.issue.name}: {activity.verb}",
            "created_at": activity.created_at,
            "href": f"/{record.workspace.slug}/projects/{activity.project_id}/issues/{activity.issue_id}/",
        }
        for activity in IssueActivity.objects.filter(
            workspace=record.workspace,
            project_id__in=project_ids,
        )
        .select_related("issue")
        .exclude(issue__isnull=True)
        .order_by("-created_at")[:20]
    ]
