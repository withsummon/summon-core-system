# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import hashlib
import json

from plane.db.models import Project
from plane.summon.models import Client, Meeting, Opportunity
from plane.summon.seed_manifest import PROJECTS, repository_id


def preview_counts(workspace):
    project_ids = set(
        Project.objects.filter(workspace=workspace, external_source="summon_seed").values_list("external_id", flat=True)
    )
    client_names = Client.objects.filter(workspace=workspace).values_list("name", flat=True)
    return (
        sum(repository_id(item) not in project_ids for item in PROJECTS),
        len({item["client"] for item in PROJECTS} - set(client_names)),
    )


def placeholder_inventory(workspace):
    records = {
        "projects": list(
            Project.objects.filter(workspace=workspace, name__in=("Test", "test 2"), archived_at__isnull=True)
            .order_by("id")
            .values("id", "name", "identifier", "description", "archived_at")
        ),
        "clients": list(
            Client.objects.filter(workspace=workspace, name="radikari")
            .order_by("id")
            .values("id", "name", "company_name", "notes", "status")
        ),
        "opportunities": list(
            Opportunity.objects.filter(workspace=workspace, title="opor123")
            .order_by("id")
            .values("id", "title", "client_id", "description", "stage", "value", "probability")
        ),
        "meetings": list(
            Meeting.objects.filter(workspace=workspace, title="tes")
            .order_by("id")
            .values("id", "title", "project_id", "agenda", "notes", "location", "starts_at", "ends_at", "status")
        ),
    }
    encoded = json.dumps(records, sort_keys=True, default=str, separators=(",", ":")).encode()
    return records, hashlib.sha256(encoded).hexdigest()
