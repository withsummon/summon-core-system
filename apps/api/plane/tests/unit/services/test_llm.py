# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from dataclasses import FrozenInstanceError
from types import SimpleNamespace

import pytest
import requests

from plane.app.services import llm
from plane.app.services.llm import LLMError, LLMRequest, LLMResponse, generate, get_llm_config
from plane.summon.services.meeting_summary import SUMMARY_SCHEMA


pytestmark = pytest.mark.unit

SECRET = "test-secret-never-log"


class FakeResponse:
    def __init__(self, data, status_code=200):
        self.data = data
        self.status_code = status_code

    def json(self):
        if isinstance(self.data, Exception):
            raise self.data
        return self.data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(response=self)


def configure(monkeypatch, provider, **overrides):
    config = {
        "provider": provider,
        "model": f"{provider}-test-model",
        "api_key": SECRET,
        "base_url": "",
        "timeout": 60,
    }
    config.update(overrides)
    monkeypatch.setattr(llm, "get_llm_config", lambda: config)


def test_request_and_response_contracts_are_immutable():
    request = LLMRequest(system="system", messages=[{"role": "user", "content": "hello"}])
    response = LLMResponse(text="ok", provider="openai", model="test")

    with pytest.raises(FrozenInstanceError):
        request.system = "changed"
    with pytest.raises(FrozenInstanceError):
        response.text = "changed"


def test_configuration_reads_base_url_timeout_and_deprecated_model_fallback(monkeypatch):
    seen = {}

    def fake_configuration_value(keys):
        seen["keys"] = [item["key"] for item in keys]
        return SECRET, "openai_compatible", "", "legacy-model", "https://llm.example.test/v1", "45"

    monkeypatch.setattr(llm, "get_configuration_value", fake_configuration_value)

    assert get_llm_config() == {
        "api_key": SECRET,
        "provider": "openai_compatible",
        "model": "legacy-model",
        "base_url": "https://llm.example.test/v1",
        "timeout": 45,
    }
    assert seen["keys"] == [
        "LLM_API_KEY",
        "LLM_PROVIDER",
        "LLM_MODEL",
        "GPT_ENGINE",
        "LLM_BASE_URL",
        "LLM_REQUEST_TIMEOUT_SECONDS",
    ]


def test_codex_configuration_uses_internal_bridge_without_api_key(monkeypatch):
    monkeypatch.setenv("CODEX_BRIDGE_URL", "http://codex-bridge:8090/")
    monkeypatch.setattr(
        llm,
        "get_configuration_value",
        lambda _keys: (None, "codex", "gpt-5.3-codex", None, "", "60"),
    )

    assert get_llm_config() == {
        "api_key": "",
        "provider": "codex",
        "model": "gpt-5.3-codex",
        "base_url": "http://codex-bridge:8090",
        "timeout": 60,
    }


def test_deployment_codex_configuration_overrides_stale_instance_provider(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "codex")
    monkeypatch.setenv("LLM_MODEL", "default")
    monkeypatch.setenv("CODEX_BRIDGE_URL", "http://codex-bridge:8090")
    monkeypatch.setattr(
        llm,
        "get_configuration_value",
        lambda _keys: (None, "openai", "gpt-5.3-codex", None, "", "60"),
    )

    assert get_llm_config() == {
        "api_key": "",
        "provider": "codex",
        "model": "default",
        "base_url": "http://codex-bridge:8090",
        "timeout": 60,
    }


@pytest.mark.parametrize("provider", ["openai", "anthropic", "gemini"])
def test_native_configuration_ignores_a_stale_compatible_base_url(monkeypatch, provider):
    monkeypatch.setattr(
        llm,
        "get_configuration_value",
        lambda _keys: (SECRET, provider, "native-model", None, "https://stale-compatible.test/v1", "60"),
    )

    assert get_llm_config()["base_url"] == ""


@pytest.mark.parametrize(
    ("values", "expected_code"),
    [
        ((None, "openai", "model", None, "", "60"), "llm_not_configured"),
        ((SECRET, "openai", None, None, "", "60"), "llm_not_configured"),
        ((SECRET, "openai", "model", None, "", "4"), "llm_not_configured"),
        ((SECRET, "openai", "model", None, "", "121"), "llm_not_configured"),
        ((SECRET, "openai", "model", None, "", "invalid"), "llm_not_configured"),
    ],
)
def test_configuration_rejects_missing_values_and_invalid_timeout(monkeypatch, values, expected_code):
    monkeypatch.setattr(llm, "get_configuration_value", lambda keys: values)

    with pytest.raises(LLMError) as error:
        get_llm_config()

    assert error.value.code == expected_code
    assert SECRET not in str(error.value)


@pytest.mark.parametrize("provider", ["openai", "openai_compatible"])
def test_openai_compatible_uses_chat_completion_and_normalizes_usage(monkeypatch, provider):
    seen = {}
    configure(
        monkeypatch,
        provider,
        model="custom-model",
        base_url="https://llm.example.test/v1",
        timeout=45,
    )

    def create(**kwargs):
        seen["request"] = kwargs
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))],
            usage=SimpleNamespace(prompt_tokens=2, completion_tokens=1),
        )

    class FakeOpenAI:
        def __init__(self, **kwargs):
            seen["client"] = kwargs
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))

    monkeypatch.setattr(llm, "OpenAI", FakeOpenAI)

    response = generate(
        LLMRequest(
            system="system",
            messages=[{"role": "user", "content": "hello"}],
            response_schema={"name": "answer", "schema": {"type": "object"}},
            temperature=0.1,
        )
    )

    assert seen["client"] == {
        "api_key": SECRET,
        "base_url": "https://llm.example.test/v1" if provider == "openai_compatible" else None,
        "timeout": 45,
    }
    assert seen["request"] == {
        "model": "custom-model",
        "messages": [
            {"role": "system", "content": "system"},
            {"role": "user", "content": "hello"},
        ],
        "temperature": 0.1,
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "answer", "schema": {"type": "object"}},
        },
    }
    assert response == LLMResponse(
        text="ok",
        provider=provider,
        model="custom-model",
        input_tokens=2,
        output_tokens=1,
    )


def test_openai_meeting_summary_wraps_the_raw_schema_for_chat_completions(monkeypatch):
    seen = {}
    configure(monkeypatch, "openai", model="gpt-test")

    def create(**kwargs):
        seen.update(kwargs)
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content='{"summary":"ok"}'))],
            usage=None,
        )

    class FakeOpenAI:
        def __init__(self, **_kwargs):
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=create))

    monkeypatch.setattr(llm, "OpenAI", FakeOpenAI)

    generate(
        LLMRequest(
            system="Summarize the meeting.",
            messages=[{"role": "user", "content": "Transcript"}],
            response_schema=SUMMARY_SCHEMA,
        )
    )

    assert seen["response_format"] == {
        "type": "json_schema",
        "json_schema": {"name": "summon_structured_response", "schema": SUMMARY_SCHEMA},
    }


def test_codex_posts_to_internal_bridge_and_normalizes_usage(monkeypatch):
    seen = {}
    configure(
        monkeypatch,
        "codex",
        api_key="",
        model="gpt-5.3-codex",
        base_url="http://codex-bridge:8090",
        timeout=60,
    )

    def post_json(url, **kwargs):
        seen.update(url=url, kwargs=kwargs)
        return {"text": '{"summary":"ok"}', "usage": {"input_tokens": 7, "output_tokens": 3}}

    monkeypatch.setattr(llm, "_post_json", post_json)
    response = generate(
        LLMRequest(
            system="Summarize the meeting.",
            messages=[{"role": "user", "content": "Transcript"}],
            response_schema=SUMMARY_SCHEMA,
        )
    )

    assert seen == {
        "url": "http://codex-bridge:8090/generate",
        "kwargs": {
            "headers": {"content-type": "application/json"},
            "payload": {
                "model": "gpt-5.3-codex",
                "system": "Summarize the meeting.",
                "messages": [{"role": "user", "content": "Transcript"}],
                "response_schema": SUMMARY_SCHEMA,
            },
            "timeout": 60,
        },
    }
    assert response == LLMResponse(
        text='{"summary":"ok"}',
        provider="codex",
        model="gpt-5.3-codex",
        input_tokens=7,
        output_tokens=3,
    )


def test_anthropic_uses_messages_contract_and_normalizes_usage(monkeypatch):
    seen = {}
    configure(monkeypatch, "anthropic", model="claude-test", base_url="https://stale-compatible.test/v1")

    def post(url, **kwargs):
        seen.update(url=url, kwargs=kwargs)
        return FakeResponse(
            {
                "content": [
                    {"type": "text", "text": "one"},
                    {"type": "text", "text": " two"},
                ],
                "usage": {"input_tokens": 2, "output_tokens": 1},
            }
        )

    monkeypatch.setattr(llm.requests, "post", post)

    response = generate(
        LLMRequest(
            system="system",
            messages=[
                {"role": "user", "content": "hello"},
                {"role": "assistant", "content": "hi"},
            ],
            temperature=0.3,
        )
    )

    assert seen["url"] == "https://api.anthropic.com/v1/messages"
    assert seen["kwargs"]["headers"] == {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "x-api-key": SECRET,
    }
    assert seen["kwargs"]["json"] == {
        "model": "claude-test",
        "max_tokens": 4096,
        "system": "system",
        "messages": [
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "hi"},
        ],
        "temperature": 0.3,
    }
    assert seen["kwargs"]["timeout"] == 60
    assert response == LLMResponse(
        text="one two",
        provider="anthropic",
        model="claude-test",
        input_tokens=2,
        output_tokens=1,
    )


def test_gemini_uses_generate_content_contract_and_normalizes_usage(monkeypatch):
    seen = {}
    configure(monkeypatch, "gemini", model="gemini/test model", base_url="https://stale-compatible.test/v1")

    def post(url, **kwargs):
        seen.update(url=url, kwargs=kwargs)
        return FakeResponse(
            {
                "candidates": [{"content": {"parts": [{"text": "one"}, {"text": " two"}]}}],
                "usageMetadata": {"promptTokenCount": 2, "candidatesTokenCount": 1},
            }
        )

    monkeypatch.setattr(llm.requests, "post", post)

    response = generate(
        LLMRequest(
            system="system",
            messages=[
                {"role": "user", "content": "hello"},
                {"role": "assistant", "content": "hi"},
            ],
            response_schema={"type": "object"},
            temperature=0.4,
        )
    )

    assert seen["url"] == (
        "https://generativelanguage.googleapis.com/v1beta/models/gemini%2Ftest%20model:generateContent"
    )
    assert seen["kwargs"]["headers"] == {"content-type": "application/json", "x-goog-api-key": SECRET}
    assert seen["kwargs"]["json"] == {
        "systemInstruction": {"parts": [{"text": "system"}]},
        "contents": [
            {"role": "user", "parts": [{"text": "hello"}]},
            {"role": "model", "parts": [{"text": "hi"}]},
        ],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "application/json",
            "responseSchema": {"type": "object"},
        },
    }
    assert seen["kwargs"]["timeout"] == 60
    assert response == LLMResponse(
        text="one two",
        provider="gemini",
        model="gemini/test model",
        input_tokens=2,
        output_tokens=1,
    )


def test_plane_external_ai_helper_uses_shared_boundary(monkeypatch):
    from plane.app.views.external import base

    seen = {}

    def fake_generate(request):
        seen["request"] = request
        return LLMResponse(text="ok", provider="openai", model="custom-model")

    monkeypatch.setattr(base, "generate", fake_generate)

    text, error = base.get_llm_response("system task", "user prompt")

    assert (text, error) == ("ok", None)
    assert seen["request"] == LLMRequest(
        system="system task",
        messages=[{"role": "user", "content": "user prompt"}],
    )
