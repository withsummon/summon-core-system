# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import transaction
from django.db.models import Q
from rest_framework import exceptions, serializers, status

from plane.app.permissions import ROLE
from plane.db.models import IssueActivity, Page, Project, ProjectMember
from plane.summon.models import Meeting, MeetingWorkItem, Opportunity, SummonPageContext, SummonProjectProfile
from plane.summon.services.reports import visible_project_ids


class DeliveryConflict(exceptions.APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "delivery_conflict"


def start_delivery(opportunity_id, project: Project, actor) -> tuple[SummonProjectProfile, bool]:
    """Link a won, client-linked opportunity to one delivery project it shares a client with.

    Idempotent for the same opportunity and project, so a retried or double-submitted
    handoff never produces a second delivery project. Returns (profile, created).
    """
    if not ProjectMember.objects.filter(project=project, member=actor, role=ROLE.ADMIN.value, is_active=True).exists():
        raise exceptions.PermissionDenied("Only project admins can start delivery in this project.")

    with transaction.atomic():
        # Different opportunities can target the same project. Lock its row before
        # checking for a profile so a competing request returns 409, not an
        # uncaught unique-constraint error.
        project = Project.objects.select_for_update().get(id=project.id)
        opportunity = (
            Opportunity.objects.select_for_update(of=("self",)).select_related("client").get(id=opportunity_id)
        )
        if opportunity.stage != Opportunity.Stage.WON:
            raise serializers.ValidationError({"stage": "Mark the opportunity as won before starting delivery."})
        if opportunity.client is None or opportunity.client.deleted_at is not None:
            raise serializers.ValidationError({"client": "Link a client to the opportunity before starting delivery."})

        linked = SummonProjectProfile.objects.filter(source_opportunity=opportunity).first()
        if linked:
            if linked.project_id == project.id:
                return linked, False
            raise DeliveryConflict({"source_opportunity": "This opportunity already has a delivery project."})

        profile = SummonProjectProfile.objects.select_for_update().filter(project=project).first()
        if profile is None:
            profile = SummonProjectProfile.objects.create(
                workspace=opportunity.workspace,
                project=project,
                client=opportunity.client,
                source_opportunity=opportunity,
            )
            return profile, True
        if profile.source_opportunity_id or (profile.client_id and profile.client_id != opportunity.client_id):
            raise DeliveryConflict({"project": "This project is already linked to another client or opportunity."})
        profile.client = opportunity.client
        profile.source_opportunity = opportunity
        profile.save(update_fields=["client", "source_opportunity", "updated_by", "updated_at"])
        return profile, False


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
    return (
        SummonProjectProfile.objects.filter(
            workspace=opportunity.workspace,
            source_opportunity=opportunity,
            project_id__in=project_ids,
        )
        .select_related("project")
        .first()
    )


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
