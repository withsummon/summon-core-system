# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import hashlib
import json

from plane.db.models import Issue, Page, Project
from plane.summon.models import (
    AutomationTemplate,
    Client,
    Meeting,
    MeetingWorkItem,
    Opportunity,
    ResourceLink,
    SummonProjectProfile,
)
from plane.summon.seed_manifest import MEETING, PROJECTS, WORK_ITEMS, client_id, repository_id
from plane.summon.services.automation import SYSTEM_TEMPLATE_SOURCE, is_adoptable_default_template
from plane.summon.services.automation_templates import DEFAULT_TEMPLATES

SOURCE = "summon_seed"


def preview_counts(workspace):
    project_ids = set(
        Project.objects.filter(workspace=workspace, external_source=SOURCE).values_list("external_id", flat=True)
    )
    missing_projects = [item for item in PROJECTS if repository_id(item) not in project_ids]
    client_ids = set(
        Client.objects.filter(workspace=workspace, external_source=SOURCE).values_list("external_id", flat=True)
    )
    templates = list(AutomationTemplate.objects.filter(workspace=workspace))
    meeting = Meeting.objects.filter(
        workspace=workspace, external_source=SOURCE, external_id=MEETING["external_id"]
    ).first()
    issue_ids = set(
        Issue.objects.filter(workspace=workspace, external_source=SOURCE).values_list("external_id", flat=True)
    )
    linked_issue_ids = set()
    if meeting:
        linked_issue_ids = set(
            MeetingWorkItem.objects.filter(workspace=workspace, meeting=meeting).values_list(
                "issue__external_id", flat=True
            )
        )
    work_item_ids = [f"{MEETING['external_id']}:{index}" for index in range(1, len(WORK_ITEMS) + 1)]
    return {
        "projects": len(missing_projects),
        "clients": sum(client_id(name) not in client_ids for name in {item["client"] for item in PROJECTS}),
        "profiles": len(missing_projects),
        "pages": len(missing_projects),
        "links": sum(1 + bool(item.get("live_url")) for item in missing_projects),
        "templates": sum(
            not any(
                (
                    template.external_source == SYSTEM_TEMPLATE_SOURCE
                    and template.external_id == f"template:{template_type}"
                )
                or is_adoptable_default_template(template, template_type, name, variables, content)
                for template in templates
            )
            for template_type, (name, variables, content) in DEFAULT_TEMPLATES.items()
        ),
        "meetings": int(meeting is None),
        "issues": sum(f"{MEETING['external_id']}:{index}" not in issue_ids for index in range(1, len(WORK_ITEMS) + 1)),
        "work_items": sum(external_id not in linked_issue_ids for external_id in work_item_ids),
    }


def seed_totals(workspace):
    projects = Project.objects.filter(workspace=workspace, external_source=SOURCE)
    meetings = Meeting.objects.filter(workspace=workspace, external_source=SOURCE)
    return {
        "projects": projects.count(),
        "clients": Client.objects.filter(workspace=workspace, external_source=SOURCE).count(),
        "profiles": SummonProjectProfile.objects.filter(workspace=workspace, project__in=projects).count(),
        "pages": Page.objects.filter(workspace=workspace, external_source=SOURCE).count(),
        "links": ResourceLink.objects.filter(workspace=workspace, project__in=projects).count(),
        "templates": AutomationTemplate.objects.filter(
            workspace=workspace, external_source=SYSTEM_TEMPLATE_SOURCE
        ).count(),
        "meetings": meetings.count(),
        "issues": Issue.objects.filter(workspace=workspace, external_source=SOURCE).count(),
        "work_items": MeetingWorkItem.objects.filter(workspace=workspace, meeting__in=meetings).count(),
    }


def placeholder_inventory(workspace, lock=False):
    def rows(queryset, *fields):
        if lock:
            queryset = queryset.select_for_update()
        return list(queryset.order_by("id").values(*fields))

    records = {
        "projects": rows(
            Project.objects.filter(workspace=workspace, name__in=("Test", "test 2"), archived_at__isnull=True),
            "id",
            "name",
            "identifier",
            "description",
            "archived_at",
        ),
        "clients": rows(
            Client.objects.filter(workspace=workspace, name="radikari"),
            "id",
            "name",
            "company_name",
            "notes",
            "status",
        ),
        "opportunities": rows(
            Opportunity.objects.filter(workspace=workspace, title="opor123"),
            "id",
            "title",
            "client_id",
            "description",
            "stage",
            "value",
            "probability",
        ),
        "meetings": rows(
            Meeting.objects.filter(workspace=workspace, title="tes"),
            "id",
            "title",
            "project_id",
            "agenda",
            "notes",
            "location",
            "starts_at",
            "ends_at",
            "status",
        ),
    }
    encoded = json.dumps(records, sort_keys=True, default=str, separators=(",", ":")).encode()
    return records, hashlib.sha256(encoded).hexdigest()
