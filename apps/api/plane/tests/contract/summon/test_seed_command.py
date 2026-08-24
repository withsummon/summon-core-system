# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone
from rest_framework import serializers

from plane.db.models import Issue, Page, Project, ProjectMember, ProjectPage
from plane.summon.models import (
    AutomationTemplate,
    Client,
    Meeting,
    MeetingWorkItem,
    Opportunity,
    ResourceLink,
    SummonProjectProfile,
)


def run_seed(workspace, user, *args):
    output = StringIO()
    call_command(
        "seed_summon_workspace",
        "--workspace",
        workspace.slug,
        "--owner-email",
        user.email,
        *args,
        stdout=output,
    )
    return output.getvalue()


def save_page_document(page, description_html, metadata):
    page.description_html = description_html
    page.description_json = {"type": metadata["type"]}
    page.description_binary = b"valid-page-document"
    page.view_props = {"summon_document": metadata}
    page.save()
    return page


@pytest.mark.django_db
def test_seed_preview_has_no_writes(workspace, create_user):
    output = run_seed(workspace, create_user)

    assert "PREVIEW" in output
    assert "created_projects=10" in output
    assert "created_clients=8" in output
    assert "created_profiles=10" in output
    assert "created_pages=10" in output
    assert "created_links=14" in output
    assert "created_templates=13" in output
    assert "created_meetings=1" in output
    assert "created_issues=4" in output
    assert Project.objects.filter(workspace=workspace).count() == 0
    assert Client.objects.filter(workspace=workspace).count() == 0
    assert AutomationTemplate.objects.filter(workspace=workspace).count() == 0


@pytest.mark.django_db
def test_seed_apply_is_complete_and_idempotent(workspace, create_user):
    with patch(
        "plane.summon.management.commands.seed_summon_workspace.write_page_document",
        side_effect=save_page_document,
    ) as converter:
        first = run_seed(workspace, create_user, "--apply")
        second = run_seed(workspace, create_user, "--apply")
        preview = run_seed(workspace, create_user)

    assert "APPLIED" in first
    assert "created_projects=10" in first
    assert "created_projects=0" in second
    assert "created_projects=0" in preview
    assert "created_clients=0" in preview
    assert "created_profiles=0" in preview
    assert "created_pages=0" in preview
    assert "created_links=0" in preview
    assert "created_templates=0" in preview
    assert "created_meetings=0" in preview
    assert "created_issues=0" in preview
    assert "total_projects=10" in first
    assert "total_clients=8" in first
    assert "total_profiles=10" in first
    assert "total_pages=10" in first
    assert "total_links=14" in first
    assert "total_templates=13" in first
    assert "total_meetings=1" in first
    assert "total_issues=4" in first
    assert "total_work_items=4" in first
    assert converter.call_count == 10
    assert Project.objects.filter(workspace=workspace).count() == 10
    assert ProjectMember.objects.filter(workspace=workspace, member=create_user).count() == 10
    assert Client.objects.filter(workspace=workspace).count() == 8
    assert SummonProjectProfile.objects.filter(workspace=workspace).count() == 10
    assert (
        SummonProjectProfile.objects.filter(
            workspace=workspace,
            delivery_status=SummonProjectProfile.DeliveryStatus.ACTIVE,
        ).count()
        == 4
    )
    assert (
        SummonProjectProfile.objects.filter(
            workspace=workspace,
            health=SummonProjectProfile.ProjectHealth.NOT_ASSESSED,
        ).count()
        == 10
    )
    assert Page.objects.filter(workspace=workspace, external_source="summon_seed").count() == 10
    assert ProjectPage.objects.filter(workspace=workspace).count() == 10
    assert ResourceLink.objects.filter(workspace=workspace, category="repository").count() == 10
    assert ResourceLink.objects.filter(workspace=workspace, category="deployment").count() == 4
    assert AutomationTemplate.objects.filter(workspace=workspace, is_active=True).count() == 13
    assert Meeting.objects.filter(workspace=workspace, status=Meeting.Status.COMPLETED).count() == 1
    assert Issue.objects.filter(workspace=workspace, external_source="summon_seed").count() == 4
    assert MeetingWorkItem.objects.filter(workspace=workspace).count() == 4


@pytest.mark.django_db
def test_seed_rerun_preserves_seeded_record_edits(workspace, create_user):
    with patch(
        "plane.summon.management.commands.seed_summon_workspace.write_page_document",
        side_effect=save_page_document,
    ):
        run_seed(workspace, create_user, "--apply")

    project = Project.objects.get(external_id="github:withsummon/pln-policy-vault")
    client = Client.objects.get(name="PLN Insurance")
    page = Page.objects.get(external_id="project-brief:github:withsummon/pln-policy-vault")
    meeting = Meeting.objects.get(title="Demo Internal DMS Asuransi PLN ke Iglo")
    issue = Issue.objects.get(external_id="meeting:pln-demo-2026-03-04:1")
    template = AutomationTemplate.objects.get(name="Bug Report")
    project.name = "PLN Vault - Operasional"
    project.identifier = "PLN-OPS"
    client.name = "PLN Insurance - Operasional"
    page.name = "Project Brief PLN - Operasional"
    meeting.title = "Demo DMS PLN - Operasional"
    issue.name = "Roadmap offering PLN - Operasional"
    template.content_template = "Template operasional yang sudah diedit"
    project.save(update_fields=["name", "identifier"])
    client.save(update_fields=["name"])
    page.save(update_fields=["name"])
    meeting.save(update_fields=["title"])
    issue.save(update_fields=["name"])
    template.save(update_fields=["content_template"])

    output = run_seed(workspace, create_user, "--apply")

    project.refresh_from_db()
    client.refresh_from_db()
    page.refresh_from_db()
    meeting.refresh_from_db()
    issue.refresh_from_db()
    template.refresh_from_db()
    assert "created_projects=0" in output
    assert Project.objects.filter(external_id="github:withsummon/pln-policy-vault").count() == 1
    assert Client.objects.filter(external_id=client.external_id).count() == 1
    assert Meeting.objects.filter(external_id=meeting.external_id).count() == 1
    assert project.name == "PLN Vault - Operasional"
    assert project.identifier == "PLN-OPS"
    assert client.name == "PLN Insurance - Operasional"
    assert page.name == "Project Brief PLN - Operasional"
    assert meeting.title == "Demo DMS PLN - Operasional"
    assert issue.name == "Roadmap offering PLN - Operasional"
    assert template.content_template == "Template operasional yang sudah diedit"


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("model", "kwargs"),
    [
        (Client, {"name": "PLN Insurance"}),
        (Client, {"name": "Other client", "external_id": "client:PLN Insurance"}),
        (
            Meeting,
            {
                "title": "Demo Internal DMS Asuransi PLN ke Iglo",
                "starts_at": timezone.now(),
            },
        ),
        (
            Meeting,
            {
                "title": "Other meeting",
                "starts_at": timezone.now(),
                "external_id": "meeting:pln-demo-2026-03-04",
            },
        ),
        (
            AutomationTemplate,
            {
                "name": "Bug Report",
                "type": "custom",
                "content_template": "custom",
            },
        ),
    ],
)
def test_seed_rejects_non_seed_collisions(workspace, create_user, model, kwargs):
    model.objects.create(workspace=workspace, **kwargs)

    with pytest.raises(CommandError, match="collision"):
        run_seed(workspace, create_user, "--apply")

    assert Project.objects.filter(workspace=workspace).count() == 0


@pytest.mark.django_db
def test_seed_collision_rolls_back_everything(workspace, create_user):
    Project.objects.create(workspace=workspace, name="BSB Logistics Management", identifier="OTHER")

    with pytest.raises(CommandError, match="collision"):
        run_seed(workspace, create_user, "--apply")

    assert Project.objects.filter(workspace=workspace).count() == 1
    assert Client.objects.filter(workspace=workspace).count() == 0


@pytest.mark.django_db
def test_page_conversion_failure_rolls_back_seed(workspace, create_user):
    with (
        patch(
            "plane.summon.management.commands.seed_summon_workspace.write_page_document",
            side_effect=serializers.ValidationError("Plane Live unavailable"),
        ),
        pytest.raises(CommandError, match="Plane Live unavailable"),
    ):
        run_seed(workspace, create_user, "--apply")

    assert Project.objects.filter(workspace=workspace).count() == 0
    assert Client.objects.filter(workspace=workspace).count() == 0


@pytest.mark.django_db
def test_placeholder_archive_requires_matching_preview_digest(workspace, create_user):
    first = Project.objects.create(workspace=workspace, name="Test", identifier="TEST")
    second = Project.objects.create(workspace=workspace, name="test 2", identifier="TEST2")
    client = Client.objects.create(workspace=workspace, name="radikari")
    opportunity = Opportunity.objects.create(workspace=workspace, client=client, title="opor123")
    meeting = Meeting.objects.create(
        workspace=workspace,
        title="tes",
        starts_at=timezone.now(),
    )

    preview = run_seed(workspace, create_user, "--archive-placeholders")
    digest = re.search(r"placeholder_digest=([a-f0-9]{64})", preview).group(1)
    assert str(first.id) in preview
    assert str(second.id) in preview
    assert str(client.id) in preview
    assert str(opportunity.id) in preview
    assert str(meeting.id) in preview

    client.notes = "changed after preview"
    client.save(update_fields=["notes"])
    with pytest.raises(CommandError, match="digest"):
        run_seed(
            workspace,
            create_user,
            "--apply",
            "--archive-placeholders",
            "--placeholder-digest",
            digest,
        )

    refreshed = run_seed(workspace, create_user, "--archive-placeholders")
    refreshed_digest = re.search(r"placeholder_digest=([a-f0-9]{64})", refreshed).group(1)
    with patch(
        "plane.summon.management.commands.seed_summon_workspace.write_page_document",
        side_effect=save_page_document,
    ):
        run_seed(
            workspace,
            create_user,
            "--apply",
            "--archive-placeholders",
            "--placeholder-digest",
            refreshed_digest,
        )

    first.refresh_from_db()
    second.refresh_from_db()
    assert first.archived_at is not None
    assert second.archived_at is not None
    assert not Client.objects.filter(pk=client.pk).exists()
    assert not Opportunity.objects.filter(pk=opportunity.pk).exists()
    assert not Meeting.objects.filter(pk=meeting.pk).exists()
