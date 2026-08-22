# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import logging
from types import SimpleNamespace

import pytest
import requests

from plane.app.services import llm
from plane.app.services.llm import LLMError, LLMRequest, generate
from plane.tests.unit.services.test_llm import FakeResponse, SECRET, configure


pytestmark = pytest.mark.unit

PROMPT = "private prompt never log"


@pytest.mark.parametrize(
    ("status_code", "data", "expected_code"),
    [
        (401, {"error": {"message": "bad key"}}, "llm_authentication_failed"),
        (429, {"error": {"message": "slow down"}}, "llm_rate_limited"),
        (504, {"error": {"message": "gateway timeout"}}, "llm_timeout"),
        (503, {"error": {"message": "offline"}}, "llm_provider_unavailable"),
        (
            400,
            {"error": {"type": "invalid_request_error", "message": "prompt is too long"}},
            "llm_context_too_large",
        ),
    ],
)
def test_http_status_errors_are_normalized(monkeypatch, status_code, data, expected_code):
    configure(monkeypatch, "anthropic")
    monkeypatch.setattr(llm.requests, "post", lambda *args, **kwargs: FakeResponse(data, status_code))

    with pytest.raises(LLMError) as error:
        generate(LLMRequest(system="system", messages=[{"role": "user", "content": "hello"}]))

    assert error.value.code == expected_code
    assert str(error.value) == llm.ERROR_MESSAGES[expected_code]


def test_transport_timeout_is_normalized(monkeypatch):
    configure(monkeypatch, "gemini")
    monkeypatch.setattr(
        llm.requests,
        "post",
        lambda *args, **kwargs: (_ for _ in ()).throw(requests.Timeout("upstream details")),
    )

    with pytest.raises(LLMError) as error:
        generate(LLMRequest(system="system", messages=[{"role": "user", "content": "hello"}]))

    assert error.value.code == "llm_timeout"


@pytest.mark.parametrize("provider", ["openai", "anthropic", "gemini"])
def test_malformed_provider_responses_are_normalized(monkeypatch, provider):
    configure(monkeypatch, provider)
    if provider == "openai":

        class FakeOpenAI:
            def __init__(self, **kwargs):
                self.chat = SimpleNamespace(
                    completions=SimpleNamespace(create=lambda **request: SimpleNamespace(choices=[], usage=None))
                )

        monkeypatch.setattr(llm, "OpenAI", FakeOpenAI)
    else:
        monkeypatch.setattr(llm.requests, "post", lambda *args, **kwargs: FakeResponse({}))

    with pytest.raises(LLMError) as error:
        generate(LLMRequest(system="system", messages=[{"role": "user", "content": "hello"}]))

    assert error.value.code == "llm_invalid_response"


def test_unsupported_provider_is_normalized(monkeypatch):
    configure(monkeypatch, "unsupported")

    with pytest.raises(LLMError) as error:
        generate(LLMRequest(system="system", messages=[{"role": "user", "content": "hello"}]))

    assert error.value.code == "llm_provider_unavailable"


def test_logs_and_errors_never_expose_secrets_prompts_or_raw_upstream_errors(monkeypatch, caplog):
    configure(monkeypatch, "anthropic")
    upstream_error = f"provider failed with {SECRET} while processing {PROMPT}"
    failures = iter(
        [
            requests.ConnectionError(upstream_error),
            FakeResponse({"error": {"message": upstream_error}}, status_code=503),
        ]
    )

    def post(*args, **kwargs):
        failure = next(failures)
        if isinstance(failure, Exception):
            raise failure
        return failure

    monkeypatch.setattr(llm.requests, "post", post)

    with caplog.at_level(logging.INFO, logger="plane.llm"):
        for _ in range(2):
            with pytest.raises(LLMError) as error:
                generate(LLMRequest(system="system", messages=[{"role": "user", "content": PROMPT}]))
            assert error.value.code == "llm_provider_unavailable"

    assert SECRET not in str(error.value)
    assert PROMPT not in str(error.value)
    assert upstream_error not in str(error.value)
    assert SECRET not in caplog.text
    assert PROMPT not in caplog.text
    assert upstream_error not in caplog.text
