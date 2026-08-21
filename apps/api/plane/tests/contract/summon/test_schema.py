# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.apps import apps
from django.db import IntegrityError, transaction


EXPECTED_MODELS = {
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
    assert GeneratedArtifact._meta.get_field("job").unique


@pytest.mark.django_db
def test_opportunity_probability_database_constraint(workspace):
    Opportunity = apps.get_model("summon", "Opportunity")

    with pytest.raises(IntegrityError), transaction.atomic():
        Opportunity.objects.create(
            workspace=workspace,
            title="Impossible probability",
            probability=101,
        )
