# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Real Summon responses must match the generated OpenAPI schema.

The schema is the contract for the generated TypeScript client (which decodes responses with it)
and for the AI tools. A serializer that emits a field the schema doesn't list, or `null` where the
schema says it can't, fails here instead of failing the AI service at runtime.
"""

from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet
from django.core.management import call_command
from drf_spectacular.generators import SchemaGenerator
from drf_spectacular.settings import patched_settings
from jsonschema import Draft202012Validator

from plane.db.models import Page, Project
from plane.summon.models import AssistantConversation, AssistantMessage, AutomationJob, Client, Meeting
from plane.summon.openapi.settings import SUMMON_SPECTACULAR_SETTINGS

# GET operations that are not JSON, or are covered by a dedicated test.
NOT_JSON = {"report_export"}


def summon_schema():
    with patched_settings(SUMMON_SPECTACULAR_SETTINGS):
        return SchemaGenerator().get_schema(request=None, public=True)


class ResponseContract:
    def __init__(self, schema):
        self.components = schema["components"]
        self.operations = {
            operation["operationId"]: operation
            for methods in schema["paths"].values()
            for operation in methods.values()
        }
        self.reads = {
            operation["operationId"]
            for methods in schema["paths"].values()
            for method, operation in methods.items()
            if method == "get" and operation["operationId"] not in NOT_JSON
        }
        self.checked = set()

    def check(self, response, operation_id, expected_status):
        assert response.status_code == expected_status, (operation_id, response.status_code, response.content[:500])
        content = self.operations[operation_id]["responses"][str(expected_status)]["content"]["application/json"]
        # OpenAPI 3.1 schemas are JSON Schema 2020-12; refs resolve against the inlined components.
        validator = Draft202012Validator({**content["schema"], "components": self.components})
        errors = sorted(validator.iter_errors(response.json()), key=lambda error: list(error.absolute_path))
        assert not errors, f"{operation_id}: " + "; ".join(
            f"{'/'.join(map(str, error.absolute_path))}: {error.message}" for error in errors[:5]
        )
        self.checked.add(operation_id)
        return response.json()


@pytest.fixture
def seeded(workspace, create_user):
    with patch(
        "plane.summon.management.commands.seed_summon_workspace.write_page_document",
        side_effect=lambda page, html, metadata: page.save() or page,
    ):
        call_command(
            "seed_summon_workspace", "--workspace", workspace.slug, "--owner-email", create_user.email, "--apply"
        )
    return workspace


@pytest.mark.django_db
def test_summon_responses_match_the_openapi_schema(seeded, create_user, session_client, settings):
    settings.SUMMON_CREDENTIAL_KEY = Fernet.generate_key().decode()
    settings.SUMMON_AI_INTERNAL_TOKEN = "contract-token"
    contract = ResponseContract(summon_schema())
    slug = seeded.slug
    base = f"/api/summon/workspaces/{slug}"
    project = Project.objects.filter(workspace=seeded).order_by("created_at").first()
    client = Client.objects.filter(workspace=seeded).order_by("created_at").first()
    meeting = Meeting.objects.filter(workspace=seeded).first()
    page = Page.objects.create(workspace=seeded, owned_by=create_user, name="Discovery notes")

    def get(path, operation_id):
        return contract.check(session_client.get(f"{base}{path}"), operation_id, 200)

    def post(path, payload, operation_id, expected_status=201):
        return contract.check(
            session_client.post(f"{base}{path}", payload, format="json"), operation_id, expected_status
        )

    # Writes, which also give the reads below something to return (with and without optional relations).
    contact = post(
        f"/clients/{client.id}/contacts/", {"name": "Dana", "email": "dana@client.test"}, "client_contact_create"
    )
    opportunity = post("/opportunities/", {"title": "Renewal", "client": str(client.id)}, "opportunity_create")
    post("/opportunities/", {"title": "Inbound lead"}, "opportunity_create")
    page_context = post(
        "/page-contexts/",
        {"page": str(page.id), "project": str(project.id), "client": str(client.id), "opportunity": opportunity["id"]},
        "page_context_create",
    )
    credential = post(
        "/credentials/", {"name": "Staging", "provider": "other", "secret": "s3cret"}, "credential_create"
    )
    conversation = post("/assistant/conversations/", {"title": "Contract"}, "assistant_conversation_create")
    stored = AssistantConversation.objects.get(id=conversation["id"])
    for role, content in ((AssistantMessage.Role.USER, "Status?"), (AssistantMessage.Role.ASSISTANT, "On track.")):
        AssistantMessage.objects.create(workspace=seeded, conversation=stored, role=role, content=content)
    job = AutomationJob.objects.create(workspace=seeded, project=project, requested_by=create_user, type="brief")

    for path, operation_id in (
        ("/home/summary/", "home_summary"),
        ("/settings/ai-status/", "ai_status"),
        ("/settings/workspace/", "workspace_settings_get"),
        ("/settings/mcp-status/", "mcp_status"),
        ("/access/me/", "access_me"),
        ("/settings/users/", "users_get"),
        ("/settings/users/history/", "users_history"),
        (f"/projects/{project.id}/people/", "project_people_get"),
        (f"/projects/{project.id}/profile/", "project_profile_get"),
        (f"/projects/{project.id}/overview/", "project_overview"),
        ("/clients/", "client_list"),
        (f"/clients/{client.id}/", "client_get"),
        (f"/clients/{client.id}/contacts/", "client_contact_list"),
        (f"/clients/{client.id}/contacts/{contact['id']}/", "client_contact_get"),
        ("/opportunities/", "opportunity_list"),
        (f"/opportunities/{opportunity['id']}/", "opportunity_get"),
        ("/meetings/", "meeting_list"),
        (f"/meetings/{meeting.id}/", "meeting_get"),
        (f"/meetings/{meeting.id}/work-items/", "meeting_work_item_list"),
        ("/page-contexts/", "page_context_list"),
        (f"/page-contexts/{page_context['id']}/", "page_context_get"),
        ("/resources/", "resource_list"),
        ("/automation/templates/", "automation_template_list"),
        ("/automation/jobs/", "automation_job_list"),
        (f"/automation/jobs/{job.id}/", "automation_job_get"),
        ("/reports/summary/", "report_summary"),
        ("/assistant/conversations/", "assistant_conversation_list"),
        (f"/assistant/conversations/{conversation['id']}/", "assistant_conversation_get"),
        (f"/assistant/conversations/{conversation['id']}/messages/", "assistant_message_list"),
        (f"/assistant/conversations/{conversation['id']}/attachments/", "assistant_attachment_list"),
        ("/credentials/", "credential_list"),
        (f"/credentials/{credential['id']}/", "credential_get"),
        (f"/credentials/{credential['id']}/grants/", "credential_grant_list"),
        (f"/credentials/{credential['id']}/audit/", "credential_audit"),
    ):
        get(path, operation_id)

    resource = session_client.get(f"{base}/resources/").json()[0]
    get(f"/resources/{resource['id']}/", "resource_get")
    template = session_client.get(f"{base}/automation/templates/").json()[0]
    get(f"/automation/templates/{template['id']}/", "automation_template_get")
    # Token-only; the test instance has no LLM configured, so this is the documented 503.
    contract.check(
        session_client.get("/api/summon/internal/ai-config/", HTTP_X_SUMMON_AI_TOKEN="contract-token"),
        "internal_ai_config",
        503,
    )

    assert contract.reads <= contract.checked, f"No response check for: {sorted(contract.reads - contract.checked)}"
