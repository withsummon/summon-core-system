# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from unittest import mock
from uuid import uuid4

import pytest
from cryptography.fernet import Fernet
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from plane.db.models import User, Workspace, WorkspaceMember
from plane.license.models import Instance
from plane.summon.models import Credential, CredentialAccessLog


def credentials_url(workspace):
    return f"/api/summon/workspaces/{workspace.slug}/credentials/"


def create_credential(api, workspace, secret="summon-secret-value"):
    return api.post(
        credentials_url(workspace),
        {
            "name": "GitHub deploy token",
            "provider": "github",
            "account_identifier": "withsummon",
            "secret": secret,
        },
        format="json",
    )


@pytest.mark.django_db
@mock.patch("plane.license.api.views.instance.get_llm_configuration_status")
@mock.patch("plane.license.api.views.instance.get_configuration_value")
def test_instance_ai_status_exposes_provider_and_model_without_key(
    get_configuration_value, get_llm_configuration_status, api_client
):
    Instance.objects.create(
        instance_name="Test Instance",
        instance_id=uuid4().hex,
        current_version="1.0.0",
        domain="http://localhost:8000",
        last_checked_at=timezone.now(),
        is_setup_done=True,
    )
    get_configuration_value.return_value = (
        "1",
        "0",
        "0",
        "0",
        "",
        "0",
        "0",
        "",
        "1",
        "1",
        None,
        None,
        None,
        "",
    )
    get_llm_configuration_status.return_value = {
        "configured": True,
        "provider": "openai",
        "model": "gpt-4o-mini",
    }

    response = api_client.get("/api/instances/")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["config"]["has_llm_configured"] is True
    assert response.data["config"]["llm_provider"] == "openai"
    assert response.data["config"]["llm_model"] == "gpt-4o-mini"
    assert "never-return-this-key" not in str(response.data)


@pytest.mark.django_db
def test_credential_is_encrypted_masked_and_reveal_requires_password(
    session_client, workspace, create_user, settings, caplog
):
    settings.SUMMON_CREDENTIAL_KEY = Fernet.generate_key().decode()
    response = create_credential(session_client, workspace)

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["secret"] == "••••••••"
    credential = Credential.objects.get(pk=response.data["id"])
    assert credential.secret_ciphertext.startswith("v1:")
    assert "summon-secret-value" not in credential.secret_ciphertext
    assert "secret_ciphertext" not in session_client.get(credentials_url(workspace)).data[0]

    reveal_url = f"{credentials_url(workspace)}{credential.id}/reveal/"
    assert session_client.post(reveal_url, {}, format="json").status_code == status.HTTP_400_BAD_REQUEST
    assert session_client.post(reveal_url, {"password": "wrong"}, format="json").status_code == 400
    revealed = session_client.post(reveal_url, {"password": "test-password"}, format="json")
    assert revealed.status_code == status.HTTP_200_OK
    assert revealed.data == {"secret": "summon-secret-value"}
    assert revealed.headers["Cache-Control"] == "no-store"
    assert "summon-secret-value" not in caplog.text
    assert "summon-secret-value" not in str(list(CredentialAccessLog.objects.values()))


@pytest.mark.django_db
def test_api_activity_log_redacts_credential_request_and_response_bodies(session_client, workspace, settings):
    settings.SUMMON_CREDENTIAL_KEY = Fernet.generate_key().decode()
    with mock.patch("plane.middleware.logger.process_logs.delay") as process_log:
        response = session_client.post(
            credentials_url(workspace),
            {"name": "Logged", "provider": "test", "secret": "never-log-this"},
            format="json",
            HTTP_X_API_KEY="force-activity-log",
        )

    assert response.status_code == status.HTTP_201_CREATED
    log_data = process_log.call_args.kwargs["log_data"]
    assert log_data["body"] == log_data["response_body"] == "[REDACTED]"
    assert "never-log-this" not in str(log_data)


@pytest.mark.django_db
def test_grant_is_workspace_scoped_and_allows_reveal(session_client, workspace, create_user, settings):
    settings.SUMMON_CREDENTIAL_KEY = Fernet.generate_key().decode()
    credential_id = create_credential(session_client, workspace).data["id"]
    identity = uuid4().hex
    grantee = User.objects.create(email=f"grantee-{identity}@plane.test", username=f"grantee_{identity}")
    grantee.set_password("grantee-password")
    grantee.save()
    WorkspaceMember.objects.create(workspace=workspace, member=grantee, role=15)
    other_workspace = Workspace.objects.create(name="Other", slug=f"other-{identity}", owner=create_user)
    outsider = User.objects.create(email=f"outside-{identity}@plane.test", username=f"outside_{identity}")
    WorkspaceMember.objects.create(workspace=other_workspace, member=outsider, role=20)
    grants_url = f"{credentials_url(workspace)}{credential_id}/grants/"

    invalid = session_client.post(
        grants_url,
        {"member": str(outsider.id), "permission": "view"},
        format="json",
    )
    granted = session_client.post(
        grants_url,
        {"member": str(grantee.id), "permission": "view"},
        format="json",
    )

    assert invalid.status_code == status.HTTP_400_BAD_REQUEST
    assert granted.status_code == status.HTTP_201_CREATED
    grantee_api = APIClient()
    grantee_api.force_login(grantee)
    reveal = grantee_api.post(
        f"{credentials_url(workspace)}{credential_id}/reveal/",
        {"password": "grantee-password"},
        format="json",
    )
    assert reveal.status_code == status.HTTP_200_OK

    revoked = session_client.delete(f"{grants_url}{granted.data['id']}/")
    assert revoked.status_code == status.HTTP_204_NO_CONTENT
    assert grantee_api.get(f"{credentials_url(workspace)}{credential_id}/").status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_rotation_and_delete_are_reauthenticated_and_audited(session_client, workspace, settings):
    settings.SUMMON_CREDENTIAL_KEY = Fernet.generate_key().decode()
    credential_id = create_credential(session_client, workspace, "old-secret").data["id"]
    credential = Credential.objects.get(pk=credential_id)
    previous_ciphertext = credential.secret_ciphertext
    rotate_url = f"{credentials_url(workspace)}{credential_id}/rotate/"

    rotated = session_client.post(
        rotate_url,
        {"password": "test-password", "secret": "new-secret"},
        format="json",
    )
    assert rotated.status_code == status.HTTP_200_OK
    credential.refresh_from_db()
    assert credential.secret_ciphertext != previous_ciphertext
    actions = list(credential.access_logs.values_list("action", flat=True))
    assert {"create", "rotate"}.issubset(actions)

    deleted = session_client.delete(
        f"{credentials_url(workspace)}{credential_id}/",
        {"password": "test-password"},
        format="json",
    )
    assert deleted.status_code == status.HTTP_204_NO_CONTENT
    assert not Credential.objects.filter(pk=credential_id).exists()
    assert CredentialAccessLog.objects.filter(credential_id=credential_id, action="delete").exists()


@pytest.mark.django_db
def test_credential_access_log_is_immutable(workspace, create_user):
    credential = Credential.objects.create(
        workspace=workspace,
        owner=create_user,
        name="Encrypted",
        provider="test",
        secret_ciphertext="v1:ciphertext",
    )
    log = CredentialAccessLog.objects.create(
        workspace=workspace,
        credential=credential,
        member=create_user,
        action="create",
    )

    log.action = "tampered"
    with pytest.raises(ValidationError):
        log.save()
    with pytest.raises(ValidationError):
        log.delete()
