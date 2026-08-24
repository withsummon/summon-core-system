# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import base64
from datetime import timedelta
from uuid import uuid4

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.app.services.llm import LLMError, LLMResponse
from plane.bgtasks import copy_s3_object, page_transaction_task
from plane.db.models import (
    Issue,
    IssueActivity,
    Page,
    Project,
    ProjectMember,
    ProjectPage,
    State,
    User,
    Workspace,
    WorkspaceMember,
)
from plane.license.models import InstanceConfiguration
from plane.license.utils.encryption import encrypt_data
from plane.summon.models import (
    AutomationJob,
    AutomationTemplate,
    Client,
    GeneratedArtifact,
    Meeting,
    Opportunity,
    SummonProjectProfile,
)
from plane.summon.services import automation


@pytest.mark.django_db
def test_workspace_ai_status_requires_workspace_admin(session_client, workspace, create_user):
    WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)

    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/settings/ai-status/")

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_workspace_ai_status_returns_only_safe_saved_status(session_client, workspace, settings):
    settings.SKIP_ENV_VAR = True
    for key, value, is_encrypted in (
        ("LLM_API_KEY", encrypt_data("test-workspace-status-key-sentinel"), True),
        ("LLM_PROVIDER", "gemini", False),
        ("LLM_MODEL", "gemini-test", False),
    ):
        InstanceConfiguration.objects.update_or_create(
            key=key,
            defaults={"value": value, "category": "AI", "is_encrypted": is_encrypted},
        )

    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/settings/ai-status/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data == {"configured": True, "provider": "gemini", "model": "gemini-test"}


@pytest.mark.django_db
def test_workspace_ai_status_reports_codex_configured_without_api_key(session_client, workspace, settings, monkeypatch):
    settings.SKIP_ENV_VAR = True
    monkeypatch.setenv("CODEX_BRIDGE_URL", "http://codex-bridge:8090")
    for key, value in (("LLM_PROVIDER", "codex"), ("LLM_MODEL", "gpt-5.3-codex")):
        InstanceConfiguration.objects.update_or_create(
            key=key,
            defaults={"value": value, "category": "AI", "is_encrypted": False},
        )
    InstanceConfiguration.objects.filter(key="LLM_API_KEY").delete()

    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/settings/ai-status/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data == {"configured": True, "provider": "codex", "model": "gpt-5.3-codex"}


def create_project(workspace, member, identifier):
    project = Project.objects.create(workspace=workspace, name=f"Project {identifier}", identifier=identifier)
    ProjectMember.objects.create(workspace=workspace, project=project, member=member, role=20)
    todo = State.objects.create(
        workspace=workspace,
        project=project,
        name=f"Todo {identifier}",
        color="#666666",
        group="unstarted",
        default=True,
    )
    done = State.objects.create(
        workspace=workspace,
        project=project,
        name=f"Done {identifier}",
        color="#00aa00",
        group="completed",
    )
    return project, todo, done


@pytest.mark.django_db
def test_default_automation_templates_are_available(session_client, workspace):
    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/automation/templates/")

    assert response.status_code == status.HTTP_200_OK
    assert {item["type"] for item in response.data} == {
        "usage_cost",
        "mom_iglo",
        "mom_summon",
        "proposal_vendor",
        "proposal_client",
        "invoice",
        "quotation",
        "cost_projection",
        "presentation",
        "uat",
        "bast",
        "timeline",
        "bug_report",
    }
    templates = {item["type"]: item for item in response.data}
    assert "Pricing Scheme" not in templates["proposal_vendor"]["content_template"]
    assert "Pricing Scheme" in templates["proposal_client"]["content_template"]
    assert "To Do" in templates["mom_iglo"]["content_template"]
    assert "marun" in templates["mom_iglo"]["content_template"]
    assert "Changes Being Tested" in templates["uat"]["content_template"]
    assert "What's Happening?" in templates["bug_report"]["content_template"]
    assert all(item["variables"] for item in response.data)


@pytest.mark.django_db(transaction=True)
def test_automation_preview_creates_no_page_and_publish_is_idempotent(
    session_client,
    workspace,
    create_user,
    monkeypatch,
):
    project, _, _ = create_project(workspace, create_user, "AUTO")
    template = AutomationTemplate.objects.create(
        workspace=workspace,
        name="Proposal",
        type="proposal",
        content_template="Create a proposal from only the supplied input and context.",
    )
    captured = []

    def fake_generate(request):
        captured.append(request)
        return LLMResponse(
            text="# Acme Proposal\n\nValidated preview.",
            provider="gemini",
            model="gemini-test",
            input_tokens=18,
            output_tokens=6,
        )

    monkeypatch.setattr(automation, "generate", fake_generate, raising=False)
    transactions = []
    monkeypatch.setattr(
        copy_s3_object,
        "sync_with_external_service",
        lambda _entity, _html: {
            "description_json": {"type": "doc", "content": [{"type": "paragraph"}]},
            "description_binary": base64.b64encode(b"canonical-page-binary").decode(),
        },
    )
    monkeypatch.setattr(page_transaction_task.page_transaction, "delay", lambda **data: transactions.append(data))
    jobs_url = f"/api/summon/workspaces/{workspace.slug}/automation/jobs/"
    payload = {
        "template": str(template.id),
        "project": str(project.id),
        "input": {"title": "Acme Proposal", "brief": "Plane migration"},
        "context": {"project_id": str(project.id)},
    }

    preview = session_client.post(jobs_url, payload, format="json")

    assert preview.status_code == status.HTTP_201_CREATED
    assert preview.data["status"] == "completed"
    assert preview.data["preview_markdown"] == "# Acme Proposal\n\nValidated preview."
    assert preview.data["provider"] == "gemini"
    assert preview.data["model"] == "gemini-test"
    assert preview.data["input_tokens"] == 18
    assert preview.data["output_tokens"] == 6
    assert preview.data["citations"] == [
        {
            "id": str(project.id),
            "label": project.name,
            "href": f"/{workspace.slug}/projects/{project.id}/issues/",
            "kind": "project",
        }
    ]
    assert captured and project.name in captured[0].messages[0]["content"]
    assert Page.objects.filter(workspace=workspace, name="Acme Proposal").count() == 0
    assert not GeneratedArtifact.objects.filter(job_id=preview.data["id"]).exists()

    publish_url = f"{jobs_url}{preview.data['id']}/publish/"
    first = session_client.post(publish_url, {}, format="json")
    second = session_client.post(publish_url, {}, format="json")

    assert first.status_code == second.status_code == status.HTTP_200_OK
    assert first.data["artifacts"][0]["id"] == second.data["artifacts"][0]["id"]
    assert first.data["artifacts"][0]["format"] == "page"
    assert first.data["artifacts"][0]["page_detail"]["href"] == (
        f"/{workspace.slug}/projects/{project.id}/pages/{first.data['artifacts'][0]['page']}/"
    )
    assert Page.objects.filter(workspace=workspace, name="Acme Proposal").count() == 1
    page = Page.objects.get(workspace=workspace, name="Acme Proposal")
    assert page.description_binary == b"canonical-page-binary"
    assert page.description_json["type"] == "doc"
    assert page.view_props["summon_document"]["markdown"] == "# Acme Proposal\n\nValidated preview."
    assert ProjectPage.objects.filter(workspace=workspace, project=project, page=page).exists()
    assert transactions == [
        {
            "new_description_html": page.description_html,
            "old_description_html": None,
            "page_id": page.id,
        }
    ]
    assert first.data["published_at"] is not None


@pytest.mark.django_db
def test_automation_preview_requires_an_authorized_project(session_client, workspace):
    template = AutomationTemplate.objects.create(
        workspace=workspace,
        name="Project-bound",
        type="proposal",
        content_template="Create a proposal.",
    )

    response = session_client.post(
        f"/api/summon/workspaces/{workspace.slug}/automation/jobs/",
        {"template": str(template.id), "input": {"title": "No project"}, "context": {}},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["error_code"] == "project_required"
    assert "project" in response.data
    assert not AutomationJob.objects.filter(template=template).exists()


@pytest.mark.django_db
def test_automation_publish_rechecks_project_membership_after_preview(
    session_client,
    workspace,
    create_user,
    monkeypatch,
):
    project, _, _ = create_project(workspace, create_user, "LOCK")
    template = AutomationTemplate.objects.create(
        workspace=workspace,
        name="Locked publish",
        type="proposal",
        content_template="Create a proposal.",
    )
    monkeypatch.setattr(
        automation,
        "generate",
        lambda _request: LLMResponse(text="# Preview", provider="openai", model="gpt-test"),
        raising=False,
    )
    jobs_url = f"/api/summon/workspaces/{workspace.slug}/automation/jobs/"
    preview = session_client.post(
        jobs_url,
        {
            "template": str(template.id),
            "project": str(project.id),
            "input": {"title": "Membership changed"},
            "context": {},
        },
        format="json",
    )
    ProjectMember.objects.filter(project=project, member=create_user).update(is_active=False)

    response = session_client.post(f"{jobs_url}{preview.data['id']}/publish/", {}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["error_code"] == "project_access_revoked"
    assert not GeneratedArtifact.objects.filter(job_id=preview.data["id"]).exists()
    assert not Page.objects.filter(workspace=workspace, name="Membership changed").exists()


@pytest.mark.django_db
def test_automation_failure_persists_only_normalized_error(session_client, workspace, create_user, monkeypatch):
    project, _, _ = create_project(workspace, create_user, "FAIL")
    template = AutomationTemplate.objects.create(
        workspace=workspace,
        name="Failure",
        type="proposal",
        content_template="Create a proposal.",
    )
    upstream_marker = "upstream-automation-body-must-not-survive"

    def fail(_request):
        error = LLMError("llm_authentication_failed")
        error.upstream_body = upstream_marker
        raise error

    monkeypatch.setattr(automation, "generate", fail, raising=False)
    jobs_url = f"/api/summon/workspaces/{workspace.slug}/automation/jobs/"
    response = session_client.post(
        jobs_url,
        {
            "template": str(template.id),
            "project": str(project.id),
            "input": {"title": "Failure"},
            "context": {},
        },
        format="json",
    )

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.data["status"] == "failed"
    assert response.data["error_code"] == "llm_authentication_failed"
    assert response.data["error_summary"] == "llm_authentication_failed"
    assert upstream_marker not in str(response.data)
    publish = session_client.post(f"{jobs_url}{response.data['id']}/publish/", {}, format="json")
    assert publish.status_code == status.HTTP_400_BAD_REQUEST
    assert Page.objects.filter(workspace=workspace, name="Failure").count() == 0


@pytest.mark.django_db
def test_automation_publish_requires_job_owner(workspace, create_user):
    job = AutomationJob.objects.create(
        workspace=workspace,
        requested_by=create_user,
        type="proposal",
        status=AutomationJob.Status.COMPLETED,
        input={"values": {"title": "Owned preview"}},
        preview_markdown="# Owned preview",
    )
    identity = uuid4().hex
    other = User.objects.create(email=f"automation-{identity}@plane.test", username=f"automation_{identity}")
    WorkspaceMember.objects.create(workspace=workspace, member=other, role=15)
    other_client = APIClient()
    other_client.force_authenticate(user=other)

    response = other_client.post(
        f"/api/summon/workspaces/{workspace.slug}/automation/jobs/{job.id}/publish/",
        {},
        format="json",
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert not GeneratedArtifact.objects.filter(job=job).exists()
    assert Page.objects.filter(workspace=workspace, name="Owned preview").count() == 0


@pytest.mark.django_db
def test_report_totals_match_canonical_queries(session_client, workspace, create_user):
    project, todo, done = create_project(workspace, create_user, "RPT")
    Issue.objects.create(
        workspace=workspace,
        project=project,
        state=todo,
        name="Late",
        target_date=timezone.now().date() - timedelta(days=1),
    )
    Issue.objects.create(workspace=workspace, project=project, state=done, name="Complete")
    client = Client.objects.create(workspace=workspace, name="Acme")
    Opportunity.objects.create(workspace=workspace, client=client, title="Renewal", stage="qualified", value="500.00")

    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/reports/summary/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["projects"] == Project.objects.filter(project_projectmember__member=create_user).count()
    assert response.data["issues"]["total"] == Issue.objects.filter(project=project).count()
    assert response.data["issues"]["completed"] == 1
    assert response.data["issues"]["overdue"] == 1
    assert response.data["commercial"]["clients"] == 1
    assert response.data["commercial"]["pipeline_value"] == "500.00"


@pytest.mark.django_db
def test_report_date_filter_keeps_recent_children_of_an_old_project(session_client, workspace, create_user):
    project, todo, _ = create_project(workspace, create_user, "OLD")
    Project.objects.filter(id=project.id).update(created_at=timezone.now() - timedelta(days=30))
    Issue.objects.create(workspace=workspace, project=project, state=todo, name="Created today")
    today = timezone.now().date()

    response = session_client.get(
        f"/api/summon/workspaces/{workspace.slug}/reports/summary/",
        {"date_from": str(today), "date_to": str(today)},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["projects"] == 0
    assert response.data["issues"]["total"] == 1


@pytest.mark.django_db
def test_report_due_buckets_exclude_completed_and_cancelled_issues(session_client, workspace, create_user):
    project, todo, done = create_project(workspace, create_user, "DUE")
    cancelled = State.objects.create(
        workspace=workspace,
        project=project,
        name="Cancelled DUE",
        color="#999999",
        group="cancelled",
    )
    today = timezone.now().date()
    Issue.objects.create(
        workspace=workspace,
        project=project,
        state=todo,
        name="Active overdue",
        target_date=today - timedelta(days=1),
    )
    for state, target_date, name in (
        (done, today - timedelta(days=1), "Completed overdue"),
        (cancelled, today, "Cancelled today"),
        (done, None, "Completed without due date"),
        (cancelled, today + timedelta(days=10), "Cancelled later"),
    ):
        Issue.objects.create(
            workspace=workspace,
            project=project,
            state=state,
            name=name,
            target_date=target_date,
        )

    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/reports/summary/")
    buckets = {item["label"]: item["count"] for item in response.data["due_date_buckets"]}

    assert response.status_code == status.HTTP_200_OK
    assert buckets == {"Overdue": 1, "Due in 7 days": 0, "Later": 0, "No due date": 0}


@pytest.mark.django_db
def test_report_filters_series_and_activity_share_the_visible_record_set(session_client, workspace, create_user):
    visible, todo, done = create_project(workspace, create_user, "VIS")
    hidden = Project.objects.create(workspace=workspace, name="Hidden", identifier="HID")
    hidden_todo = State.objects.create(
        workspace=workspace,
        project=hidden,
        name="Hidden todo",
        color="#666666",
        group="unstarted",
        default=True,
    )
    other_workspace = Workspace.objects.create(name="Other", slug=f"other-{uuid4().hex}", owner=create_user)
    foreign = Project.objects.create(workspace=other_workspace, name="Foreign", identifier="FOR")
    foreign_todo = State.objects.create(
        workspace=other_workspace,
        project=foreign,
        name="Foreign todo",
        color="#666666",
        group="unstarted",
        default=True,
    )
    today = timezone.now().date()
    late = Issue.objects.create(
        workspace=workspace,
        project=visible,
        state=todo,
        name="Visible late",
        target_date=today - timedelta(days=1),
    )
    Issue.objects.create(workspace=workspace, project=visible, state=done, name="Visible complete")
    Issue.objects.create(workspace=workspace, project=hidden, state=hidden_todo, name="HIDDEN ISSUE")
    Issue.objects.create(workspace=other_workspace, project=foreign, state=foreign_todo, name="FOREIGN ISSUE")
    IssueActivity.objects.create(
        workspace=workspace,
        project=visible,
        issue=late,
        verb="created visible activity",
    )
    hidden_issue = Issue.objects.get(project=hidden)
    IssueActivity.objects.create(
        workspace=workspace,
        project=hidden,
        issue=hidden_issue,
        verb="HIDDEN ACTIVITY",
    )
    client = Client.objects.create(workspace=workspace, name="Visible client")
    SummonProjectProfile.objects.create(
        workspace=workspace,
        project=visible,
        client=client,
        health=SummonProjectProfile.ProjectHealth.AT_RISK,
    )
    Opportunity.objects.create(
        workspace=workspace,
        client=client,
        title="Visible opportunity",
        stage=Opportunity.Stage.QUALIFIED,
        value="123.45",
    )
    old_opportunity = Opportunity.objects.create(
        workspace=workspace,
        client=client,
        title="Outside date range",
        stage=Opportunity.Stage.PROPOSAL,
        value="900.00",
    )
    Opportunity.objects.filter(pk=old_opportunity.pk).update(created_at=timezone.now() - timedelta(days=2))
    Meeting.objects.create(
        workspace=workspace,
        project=visible,
        title="Visible meeting",
        status=Meeting.Status.COMPLETED,
        starts_at=timezone.now(),
    )
    Meeting.objects.create(workspace=workspace, project=hidden, title="HIDDEN MEETING", starts_at=timezone.now())
    AutomationJob.objects.create(
        workspace=workspace,
        project=visible,
        requested_by=create_user,
        type="report",
        status=AutomationJob.Status.FAILED,
    )
    AutomationJob.objects.create(
        workspace=workspace,
        project=hidden,
        requested_by=create_user,
        type="hidden",
        status=AutomationJob.Status.COMPLETED,
    )

    response = session_client.get(
        f"/api/summon/workspaces/{workspace.slug}/reports/summary/",
        {"project_id": str(visible.id), "client_id": str(client.id), "date_from": str(today), "date_to": str(today)},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["projects"] == 1
    assert response.data["issues"] == {"total": 2, "completed": 1, "overdue": 1}
    assert response.data["commercial"] == {"clients": 1, "opportunities": 1, "pipeline_value": "123.45"}
    assert response.data["project_health"] == [
        {"project_id": str(visible.id), "name": visible.name, "health": "at_risk", "completion": 50}
    ]
    assert sum(item["count"] for item in response.data["opportunity_stages"]) == 1
    assert sum(item["count"] for item in response.data["due_date_buckets"]) == 1
    assert sum(item["completed"] for item in response.data["completion_trend"]) == 1
    assert response.data["meetings"] == 1
    assert sum(item["count"] for item in response.data["meeting_statuses"]) == 1
    assert sum(item["count"] for item in response.data["meeting_trend"]) == 1
    assert response.data["automation"] == {"jobs": 1, "completed": 0, "failed": 1}
    assert sum(item["count"] for item in response.data["automation_statuses"]) == 1
    assert sum(item["count"] for item in response.data["automation_usage"]) == 1
    assert len(response.data["recent_activity"]) == 1
    assert "created visible activity" in response.data["recent_activity"][0]["label"]
    assert "HIDDEN" not in str(response.data)
    assert "FOREIGN" not in str(response.data)

    hidden_response = session_client.get(
        f"/api/summon/workspaces/{workspace.slug}/reports/summary/",
        {"project_id": str(hidden.id)},
    )
    assert hidden_response.status_code == status.HTTP_200_OK
    assert hidden_response.data["projects"] == 0
    assert hidden_response.data["issues"]["total"] == 0
    assert "Hidden" not in str(hidden_response.data)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("query", "field"),
    [
        ({"project_id": "not-a-uuid"}, "project_id"),
        ({"client_id": "not-a-uuid"}, "client_id"),
        ({"date_from": "2026-02-30"}, "date_from"),
        ({"date_from": "2026-08-23", "date_to": "2026-08-22"}, "date_to"),
    ],
)
def test_report_rejects_invalid_filters(session_client, workspace, query, field):
    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/reports/summary/", query)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert field in response.data


@pytest.mark.django_db
def test_report_inaccessible_filter_is_indistinguishable_from_empty(session_client, workspace, create_user):
    foreign_workspace = Workspace.objects.create(name="Foreign", slug=f"foreign-{uuid4().hex}", owner=create_user)
    foreign_client = Client.objects.create(workspace=foreign_workspace, name="Foreign client")

    response = session_client.get(
        f"/api/summon/workspaces/{workspace.slug}/reports/summary/",
        {"client_id": str(foreign_client.id)},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["projects"] == 0
    assert response.data["issues"] == {"total": 0, "completed": 0, "overdue": 0}
    assert response.data["commercial"] == {"clients": 0, "opportunities": 0, "pipeline_value": "0.00"}
    assert response.data["project_health"] == []
    assert response.data["recent_activity"] == []
    assert all(item["count"] == 0 for item in response.data["opportunity_stages"])


@pytest.mark.django_db
@pytest.mark.parametrize(
    "dangerous_name",
    ["=cmd", "+cmd", "-cmd", "@cmd", " =cmd", "\t=cmd", "\r=cmd", "\n=cmd"],
)
def test_report_csv_uses_matching_filters_and_neutralizes_formula_cells(
    session_client,
    workspace,
    create_user,
    dangerous_name,
):
    visible, _, _ = create_project(workspace, create_user, "CSV")
    dangerous = Client.objects.create(workspace=workspace, name=dangerous_name)
    Client.objects.create(workspace=workspace, name="Outside filter")
    SummonProjectProfile.objects.create(workspace=workspace, project=visible, client=dangerous)

    response = session_client.get(
        f"/api/summon/workspaces/{workspace.slug}/reports/export.csv",
        {"client_id": str(dangerous.id)},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response["Content-Type"].startswith("text/csv")
    assert response["Content-Disposition"] == f'attachment; filename="summon-report-{workspace.slug}.csv"'
    assert f"'{dangerous_name}".encode() in response.content
    assert b"Outside filter" not in response.content
    assert b"Commercial,Clients,1" in response.content


@pytest.mark.django_db
def test_assistant_never_returns_unauthorized_project_data(session_client, workspace, create_user):
    visible, visible_todo, _ = create_project(workspace, create_user, "VIS")
    hidden = Project.objects.create(workspace=workspace, name="Hidden Project", identifier="HID")
    hidden_todo = State.objects.create(
        workspace=workspace,
        project=hidden,
        name="Hidden todo",
        color="#666666",
        group="unstarted",
        default=True,
    )
    overdue = timezone.now().date() - timedelta(days=1)
    Issue.objects.create(
        workspace=workspace, project=visible, state=visible_todo, name="Visible overdue", target_date=overdue
    )
    Issue.objects.create(workspace=workspace, project=hidden, state=hidden_todo, name="TOP SECRET", target_date=overdue)
    url = f"/api/summon/workspaces/{workspace.slug}/assistant/query/"

    response = session_client.post(url, {"intent": "overdue_work_items"}, format="json")
    unsupported = session_client.post(url, {"intent": "write_fiction"}, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert "Visible overdue" in str(response.data)
    assert "TOP SECRET" not in str(response.data)
    assert unsupported.data == {
        "intent": "unsupported",
        "answer": "Intent is not supported by Summon Core.",
        "data": [],
    }
