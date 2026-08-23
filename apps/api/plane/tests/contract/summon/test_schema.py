# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.apps import apps
from django.db import IntegrityError, models, transaction
from django.db.models.deletion import ProtectedError
from django.utils import timezone


EXPECTED_MODELS = {
    "AssistantAction",
    "AssistantConversation",
    "AssistantMessage",
    "AutomationJob",
    "AutomationTemplate",
    "Client",
    "ClientContact",
    "Credential",
    "CredentialAccessLog",
    "CredentialGrant",
    "GeneratedArtifact",
    "Meeting",
    "MeetingParticipant",
    "MeetingWorkItem",
    "Opportunity",
    "ResourceLink",
    "SummonPageContext",
    "SummonProjectProfile",
    "SummonWorkspaceSettings",
}


def test_summon_model_allowlist_and_workspace_ownership():
    app = apps.get_app_config("summon")
    models = list(app.get_models())

    assert {model.__name__ for model in models} == EXPECTED_MODELS
    assert all("workspace" in {field.name for field in model._meta.fields} for model in models)


def test_schema_has_canonical_link_constraints():
    MeetingWorkItem = apps.get_model("summon", "MeetingWorkItem")
    GeneratedArtifact = apps.get_model("summon", "GeneratedArtifact")

    meeting_constraints = {constraint.name for constraint in MeetingWorkItem._meta.constraints}
    artifact_constraints = {constraint.name for constraint in GeneratedArtifact._meta.constraints}

    assert "summon_unique_meeting_issue" in meeting_constraints
    assert "summon_artifact_exactly_one_target" in artifact_constraints
    assert "summon_unique_artifact_job_format" in artifact_constraints


def test_pdf_owned_fields_are_persisted_without_replacing_plane_entities():
    Client = apps.get_model("summon", "Client")
    Opportunity = apps.get_model("summon", "Opportunity")
    AssistantConversation = apps.get_model("summon", "AssistantConversation")
    AssistantAction = apps.get_model("summon", "AssistantAction")
    SummonWorkspaceSettings = apps.get_model("summon", "SummonWorkspaceSettings")

    assert {"website", "head_office", "relationship_started_at"}.issubset({field.name for field in Client._meta.fields})
    assert {"product", "source"}.issubset({field.name for field in Opportunity._meta.fields})
    assert AssistantConversation._meta.get_field("mcp_credential").remote_field.model._meta.model_name == "credential"
    assert AssistantAction._meta.get_field("requester").remote_field.model._meta.model_name == "user"
    assert SummonWorkspaceSettings._meta.get_field("workspace").one_to_one is True


def test_canonical_delete_policies_preserve_audit_without_blocking_plane_records():
    GeneratedArtifact = apps.get_model("summon", "GeneratedArtifact")
    Credential = apps.get_model("summon", "Credential")
    CredentialAccessLog = apps.get_model("summon", "CredentialAccessLog")

    assert GeneratedArtifact._meta.get_field("page").remote_field.on_delete is models.CASCADE
    assert GeneratedArtifact._meta.get_field("file_asset").remote_field.on_delete is models.CASCADE
    assert Credential._meta.get_field("project").remote_field.on_delete is models.SET_NULL
    assert CredentialAccessLog._meta.get_field("credential").remote_field.on_delete is models.PROTECT


def test_recreatable_unique_constraints_ignore_soft_deleted_rows():
    constraint_names = {
        "summon_unique_client_contact_email",
        "summon_unique_client_name",
        "summon_unique_converted_opportunity",
        "summon_unique_credential_grant",
        "summon_unique_artifact_job_format",
        "summon_unique_meeting_issue",
        "summon_unique_meeting_participant",
        "summon_unique_opportunity_identity",
        "summon_unique_page_context",
        "summon_unique_project_profile",
        "summon_unique_template_name",
    }
    constraints = {
        constraint.name: constraint
        for model in apps.get_app_config("summon").get_models()
        for constraint in model._meta.constraints
        if constraint.name in constraint_names
    }

    assert constraints.keys() == constraint_names
    assert all("deleted_at" in str(constraint.condition) for constraint in constraints.values())


@pytest.mark.django_db
def test_opportunity_probability_database_constraint(workspace):
    Opportunity = apps.get_model("summon", "Opportunity")

    with pytest.raises(IntegrityError), transaction.atomic():
        Opportunity.objects.create(
            workspace=workspace,
            title="Impossible probability",
            probability=101,
        )


@pytest.mark.django_db
def test_soft_deleted_scoped_identity_can_be_recreated(workspace):
    Client = apps.get_model("summon", "Client")
    client = Client.objects.create(workspace=workspace, name="Acme")

    with pytest.raises(IntegrityError), transaction.atomic():
        Client.objects.create(workspace=workspace, name="Acme")

    Client.objects.filter(pk=client.pk).update(deleted_at=timezone.now())

    replacement = Client.objects.create(workspace=workspace, name="Acme")
    assert replacement.pk != client.pk


@pytest.mark.django_db
def test_generated_artifact_requires_exactly_one_canonical_target(workspace):
    AutomationJob = apps.get_model("summon", "AutomationJob")
    GeneratedArtifact = apps.get_model("summon", "GeneratedArtifact")
    job = AutomationJob.objects.create(workspace=workspace, type="mom")

    with pytest.raises(IntegrityError), transaction.atomic():
        GeneratedArtifact.objects.create(workspace=workspace, job=job, title="MoM", kind="page")


@pytest.mark.django_db
def test_credential_access_log_protects_credential_audit_chain(workspace):
    Credential = apps.get_model("summon", "Credential")
    CredentialAccessLog = apps.get_model("summon", "CredentialAccessLog")
    credential = Credential.objects.create(
        workspace=workspace,
        name="GitHub",
        provider="github",
        secret_ciphertext="ciphertext",
    )
    CredentialAccessLog.objects.create(workspace=workspace, credential=credential, action="view")

    with pytest.raises(ProtectedError):
        credential.delete(soft=False)


@pytest.mark.django_db
def test_soft_deleted_extension_records_can_be_recreated(workspace):
    AutomationJob = apps.get_model("summon", "AutomationJob")
    GeneratedArtifact = apps.get_model("summon", "GeneratedArtifact")
    Opportunity = apps.get_model("summon", "Opportunity")
    Page = apps.get_model("db", "Page")
    Project = apps.get_model("db", "Project")
    SummonPageContext = apps.get_model("summon", "SummonPageContext")
    SummonProjectProfile = apps.get_model("summon", "SummonProjectProfile")
    page = Page.objects.create(workspace=workspace, owned_by=workspace.owner, name="Output")
    project = Project.objects.create(workspace=workspace, name="Delivery", identifier="DEL")
    opportunity = Opportunity.objects.create(workspace=workspace, title="Delivery")
    job = AutomationJob.objects.create(workspace=workspace, type="mom")
    records = [
        GeneratedArtifact.objects.create(workspace=workspace, job=job, page=page, title="MoM", kind="page"),
        SummonPageContext.objects.create(workspace=workspace, page=page, project=project),
        SummonProjectProfile.objects.create(
            workspace=workspace,
            project=project,
            source_opportunity=opportunity,
        ),
    ]

    for record in records:
        type(record).objects.filter(pk=record.pk).update(deleted_at=timezone.now())

    assert GeneratedArtifact.objects.create(workspace=workspace, job=job, page=page, title="MoM v2", kind="page")
    assert SummonPageContext.objects.create(workspace=workspace, page=page, project=project)
    assert SummonProjectProfile.objects.create(
        workspace=workspace,
        project=project,
        source_opportunity=opportunity,
    )
