# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from uuid import uuid4

import pytest
from django.utils import timezone
from rest_framework import status

from plane.app.services.llm import LLMError, LLMResponse, get_llm_config
from plane.license.models import Instance, InstanceAdmin, InstanceConfiguration
from plane.license.utils.encryption import decrypt_data, encrypt_data


LLM_CONFIGURATION = {
    "LLM_API_KEY": ("test-saved-key-sentinel", True),
    "LLM_PROVIDER": ("anthropic", False),
    "LLM_MODEL": ("claude-test", False),
    "LLM_BASE_URL": ("", False),
    "LLM_REQUEST_TIMEOUT_SECONDS": ("30", False),
}


def create_instance_admin(user):
    instance = Instance.objects.create(
        instance_name="Test Instance",
        instance_id=uuid4().hex,
        current_version="1.0.0",
        last_checked_at=timezone.now(),
    )
    InstanceAdmin.objects.create(instance=instance, user=user, role=20)
    return instance


def create_llm_configuration():
    for key, (value, is_encrypted) in LLM_CONFIGURATION.items():
        InstanceConfiguration.objects.update_or_create(
            key=key,
            defaults={
                "value": encrypt_data(value) if is_encrypted else value,
                "category": "AI",
                "is_encrypted": is_encrypted,
            },
        )


@pytest.mark.django_db
def test_llm_configuration_requires_instance_admin(api_client, session_client, workspace):
    assert api_client.post("/api/instances/configurations/test-llm/", {}, format="json").status_code in {
        status.HTTP_401_UNAUTHORIZED,
        status.HTTP_403_FORBIDDEN,
    }
    assert (
        session_client.post("/api/instances/configurations/test-llm/", {}, format="json").status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"LLM_PROVIDER": "unsupported"}, "LLM_PROVIDER"),
        ({"LLM_MODEL": "  "}, "LLM_MODEL"),
        ({"LLM_BASE_URL": "ftp://provider.test/v1"}, "LLM_BASE_URL"),
        ({"LLM_BASE_URL": "https://user:password@provider.test/v1"}, "LLM_BASE_URL"),
        (
            {"LLM_PROVIDER": "openai", "LLM_BASE_URL": "https://compatible-only.test/v1"},
            "LLM_BASE_URL",
        ),
        ({"LLM_REQUEST_TIMEOUT_SECONDS": "4"}, "LLM_REQUEST_TIMEOUT_SECONDS"),
        ({"LLM_REQUEST_TIMEOUT_SECONDS": "121"}, "LLM_REQUEST_TIMEOUT_SECONDS"),
        ({"LLM_REQUEST_TIMEOUT_SECONDS": "60.5"}, "LLM_REQUEST_TIMEOUT_SECONDS"),
    ],
)
def test_llm_configuration_rejects_invalid_values(session_client, create_user, payload, field):
    create_instance_admin(create_user)
    create_llm_configuration()

    response = session_client.patch("/api/instances/configurations/", payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert field in response.data


@pytest.mark.django_db
def test_llm_configuration_saves_key_encrypted_and_never_returns_it(session_client, create_user):
    create_instance_admin(create_user)
    create_llm_configuration()
    secret = "test-replacement-key-sentinel"

    response = session_client.patch(
        "/api/instances/configurations/",
        {
            "LLM_API_KEY": secret,
            "LLM_PROVIDER": "openai_compatible",
            "LLM_MODEL": "custom-model",
            "LLM_BASE_URL": "https://provider.test/v1",
            "LLM_REQUEST_TIMEOUT_SECONDS": "45",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    saved_key = InstanceConfiguration.objects.get(key="LLM_API_KEY")
    assert saved_key.value != secret
    assert decrypt_data(saved_key.value) == secret
    assert secret not in str(response.data)
    assert secret not in str(session_client.get("/api/instances/configurations/").data)


@pytest.mark.django_db
def test_switching_to_native_provider_clears_compatible_base_url_without_touching_the_key(
    session_client, create_user, settings
):
    create_instance_admin(create_user)
    create_llm_configuration()
    settings.SKIP_ENV_VAR = True
    saved_key = InstanceConfiguration.objects.get(key="LLM_API_KEY")
    original_encrypted_key = saved_key.value
    InstanceConfiguration.objects.filter(key="LLM_PROVIDER").update(value="openai_compatible")
    InstanceConfiguration.objects.filter(key="LLM_BASE_URL").update(value="https://compatible-only.test/v1")

    response = session_client.patch(
        "/api/instances/configurations/",
        {"LLM_PROVIDER": "openai"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert InstanceConfiguration.objects.get(key="LLM_BASE_URL").value == ""
    assert InstanceConfiguration.objects.get(key="LLM_API_KEY").value == original_encrypted_key
    InstanceConfiguration.objects.filter(key="LLM_BASE_URL").update(value="https://stale-compatible.test/v1")
    assert get_llm_config()["base_url"] == ""


@pytest.mark.django_db
def test_llm_connection_test_uses_saved_configuration_without_request_overrides(
    session_client, create_user, settings, monkeypatch
):
    create_instance_admin(create_user)
    create_llm_configuration()
    settings.SKIP_ENV_VAR = True
    seen = {}

    def fake_generate(request):
        config = get_llm_config()
        seen.update(config)
        return LLMResponse(text="ok", provider=config["provider"], model=config["model"])

    monkeypatch.setattr("plane.license.api.views.configuration.generate", fake_generate, raising=False)
    response = session_client.post(
        "/api/instances/configurations/test-llm/",
        {
            "LLM_API_KEY": "test-request-key-sentinel",
            "LLM_PROVIDER": "gemini",
            "LLM_MODEL": "request-model",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data == {"status": "ok", "provider": "anthropic", "model": "claude-test"}
    assert seen["provider"] == "anthropic"
    assert seen["model"] == "claude-test"
    assert seen["api_key"] == "test-saved-key-sentinel"
    assert "key" not in str(response.data).lower()


@pytest.mark.django_db
def test_llm_connection_test_returns_only_normalized_error(session_client, create_user, monkeypatch):
    create_instance_admin(create_user)
    create_llm_configuration()

    def fail(_request):
        raise LLMError("llm_timeout")

    monkeypatch.setattr("plane.license.api.views.configuration.generate", fail, raising=False)
    response = session_client.post("/api/instances/configurations/test-llm/", {}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data == {"status": "error", "code": "llm_timeout"}
