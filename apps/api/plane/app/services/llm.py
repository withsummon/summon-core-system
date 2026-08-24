# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
import logging
import os
from dataclasses import dataclass
from time import monotonic
from typing import Literal, TypedDict
from urllib.parse import quote
from uuid import uuid4

import requests
from openai import APITimeoutError, OpenAI

from plane.license.utils.instance_value import get_configuration_value


LLMErrorCode = Literal[
    "llm_not_configured",
    "llm_authentication_failed",
    "llm_rate_limited",
    "llm_timeout",
    "llm_provider_unavailable",
    "llm_invalid_response",
    "llm_context_too_large",
]

ERROR_MESSAGES: dict[LLMErrorCode, str] = {
    "llm_not_configured": "The instance LLM is not configured.",
    "llm_authentication_failed": "The LLM provider rejected its credentials.",
    "llm_rate_limited": "The LLM provider rate limit was reached. Try again later.",
    "llm_timeout": "The LLM provider timed out. Try again.",
    "llm_provider_unavailable": "The configured LLM provider is unavailable.",
    "llm_invalid_response": "The LLM provider returned an invalid response.",
    "llm_context_too_large": "The selected context is too large for the LLM provider.",
}

logger = logging.getLogger("plane.llm")


class LLMConfig(TypedDict):
    api_key: str
    provider: str
    model: str
    base_url: str
    timeout: int


@dataclass(frozen=True)
class LLMRequest:
    system: str
    messages: list[dict[str, str]]
    response_schema: dict | None = None
    temperature: float = 0.2


@dataclass(frozen=True)
class LLMResponse:
    text: str
    provider: str
    model: str
    input_tokens: int | None = None
    output_tokens: int | None = None


class LLMError(Exception):
    def __init__(self, code: LLMErrorCode):
        self.code = code
        super().__init__(ERROR_MESSAGES[code])


def _text(value) -> str:
    return value.strip() if isinstance(value, str) else ""


def get_llm_config() -> LLMConfig:
    keys = (
        ("LLM_API_KEY", None),
        ("LLM_PROVIDER", "openai"),
        ("LLM_MODEL", None),
        ("GPT_ENGINE", None),
        ("LLM_BASE_URL", ""),
        ("LLM_REQUEST_TIMEOUT_SECONDS", "60"),
    )
    api_key, provider, model, legacy_model, base_url, timeout_value = get_configuration_value(
        [{"key": key, "default": os.environ.get(key, default)} for key, default in keys]
    )
    api_key, provider = _text(api_key), _text(provider).lower() or "openai"
    model = _text(model) or _text(legacy_model)
    try:
        timeout = int(timeout_value)
    except (TypeError, ValueError):
        raise LLMError("llm_not_configured") from None
    if not model or not 5 <= timeout <= 120:
        raise LLMError("llm_not_configured")
    if provider != "codex" and not api_key:
        raise LLMError("llm_not_configured")
    if provider == "codex":
        base_url = _text(os.environ.get("CODEX_BRIDGE_URL")).rstrip("/")
        if not base_url:
            raise LLMError("llm_not_configured")
    elif provider == "openai_compatible":
        base_url = _text(base_url).rstrip("/")
    else:
        base_url = ""
    return {
        "api_key": api_key,
        "provider": provider,
        "model": model,
        "base_url": base_url,
        "timeout": timeout,
    }


def _context_overflow(data) -> bool:
    try:
        detail = json.dumps(data).lower()
    except (TypeError, ValueError):
        return False
    markers = (
        "context_length_exceeded",
        "context window",
        "prompt is too long",
        "request too large",
        "token limit",
        "too many tokens",
    )
    return any(marker in detail for marker in markers)


def _normalized_error(error, data=None) -> LLMError:
    response = getattr(error, "response", None)
    status_code = getattr(error, "status_code", None) or getattr(response, "status_code", None)
    if data is None:
        data = getattr(error, "body", None)
    if status_code == 413 or _context_overflow(data):
        return LLMError("llm_context_too_large")
    if status_code in {401, 403} or error.__class__.__name__ == "AuthenticationError":
        return LLMError("llm_authentication_failed")
    if status_code == 429 or error.__class__.__name__ == "RateLimitError":
        return LLMError("llm_rate_limited")
    if status_code in {408, 504} or isinstance(error, (requests.Timeout, APITimeoutError)):
        return LLMError("llm_timeout")
    return LLMError("llm_provider_unavailable")


def _post_json(url, *, headers, payload, timeout):
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=timeout)
        response.raise_for_status()
    except requests.HTTPError as error:
        try:
            data = error.response.json()
        except (AttributeError, TypeError, ValueError):
            data = None
        raise _normalized_error(error, data) from None
    except requests.RequestException as error:
        raise _normalized_error(error) from None
    try:
        data = response.json()
    except (TypeError, ValueError):
        raise LLMError("llm_invalid_response") from None
    if not isinstance(data, dict):
        raise LLMError("llm_invalid_response")
    return data


def _usage_value(usage, name):
    value = usage.get(name) if isinstance(usage, dict) else getattr(usage, name, None)
    return value if isinstance(value, int) and value >= 0 else None


def _response(text, config, usage, input_name, output_name):
    if not isinstance(text, str) or not text:
        raise LLMError("llm_invalid_response")
    return LLMResponse(
        text=text,
        provider=config["provider"],
        model=config["model"],
        input_tokens=_usage_value(usage, input_name),
        output_tokens=_usage_value(usage, output_name),
    )


def _openai_response_schema(schema):
    if isinstance(schema.get("name"), str) and isinstance(schema.get("schema"), dict):
        return schema
    return {"name": "summon_structured_response", "schema": schema}


class _Provider:
    def __init__(self, config: LLMConfig):
        self.config = config


class OpenAICompatibleProvider(_Provider):
    def generate(self, request: LLMRequest) -> LLMResponse:
        client = OpenAI(
            api_key=self.config["api_key"],
            base_url=self.config["base_url"] if self.config["provider"] == "openai_compatible" else None,
            timeout=self.config["timeout"],
        )
        payload = {
            "model": self.config["model"],
            "messages": [
                *([{"role": "system", "content": request.system}] if request.system else []),
                *[{"role": message["role"], "content": message["content"]} for message in request.messages],
            ],
            "temperature": request.temperature,
        }
        if request.response_schema:
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": _openai_response_schema(request.response_schema),
            }
        try:
            result = client.chat.completions.create(**payload)
            text = result.choices[0].message.content
            usage = result.usage
        except (AttributeError, IndexError, KeyError, TypeError):
            raise LLMError("llm_invalid_response") from None
        except Exception as error:
            raise _normalized_error(error) from None
        return _response(text, self.config, usage, "prompt_tokens", "completion_tokens")


class CodexProvider(_Provider):
    def generate(self, request: LLMRequest) -> LLMResponse:
        data = _post_json(
            f"{self.config['base_url']}/generate",
            headers={"content-type": "application/json"},
            payload={
                "model": self.config["model"],
                "system": request.system,
                "messages": request.messages,
                "response_schema": request.response_schema,
            },
            timeout=self.config["timeout"],
        )
        return _response(data.get("text"), self.config, data.get("usage"), "input_tokens", "output_tokens")


class AnthropicProvider(_Provider):
    def generate(self, request: LLMRequest) -> LLMResponse:
        payload = {
            "model": self.config["model"],
            "max_tokens": 4096,
            **({"system": request.system} if request.system else {}),
            "messages": [dict(message) for message in request.messages],
            "temperature": request.temperature,
        }
        data = _post_json(
            "https://api.anthropic.com/v1/messages",
            headers={
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
                "x-api-key": self.config["api_key"],
            },
            payload=payload,
            timeout=self.config["timeout"],
        )
        content = data.get("content")
        if not isinstance(content, list):
            raise LLMError("llm_invalid_response")
        text = "".join(
            block["text"]
            for block in content
            if isinstance(block, dict) and block.get("type") == "text" and isinstance(block.get("text"), str)
        )
        return _response(text, self.config, data.get("usage"), "input_tokens", "output_tokens")


class GeminiProvider(_Provider):
    def generate(self, request: LLMRequest) -> LLMResponse:
        generation_config = {"temperature": request.temperature}
        if request.response_schema:
            generation_config["responseMimeType"] = "application/json"
            generation_config["responseSchema"] = request.response_schema
        payload = {
            **({"systemInstruction": {"parts": [{"text": request.system}]}} if request.system else {}),
            "contents": [
                {
                    "role": "model" if message["role"] == "assistant" else message["role"],
                    "parts": [{"text": message["content"]}],
                }
                for message in request.messages
            ],
            "generationConfig": generation_config,
        }
        model = quote(self.config["model"], safe="")
        data = _post_json(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"content-type": "application/json", "x-goog-api-key": self.config["api_key"]},
            payload=payload,
            timeout=self.config["timeout"],
        )
        try:
            parts = data["candidates"][0]["content"]["parts"]
            text = "".join(part["text"] for part in parts if isinstance(part.get("text"), str))
        except (AttributeError, IndexError, KeyError, TypeError):
            raise LLMError("llm_invalid_response") from None
        return _response(text, self.config, data.get("usageMetadata"), "promptTokenCount", "candidatesTokenCount")


def get_llm_provider(config: LLMConfig):
    providers = {
        "openai": OpenAICompatibleProvider,
        "openai_compatible": OpenAICompatibleProvider,
        "codex": CodexProvider,
        "anthropic": AnthropicProvider,
        "gemini": GeminiProvider,
    }
    try:
        return providers[config["provider"]](config)
    except KeyError:
        raise LLMError("llm_provider_unavailable") from None


def generate(request: LLMRequest) -> LLMResponse:
    started_at = monotonic()
    request_id = uuid4().hex
    provider = model = None
    response = None
    request_status = "ok"
    try:
        config = get_llm_config()
        provider, model = config["provider"], config["model"]
        response = get_llm_provider(config).generate(request)
    except LLMError as error:
        request_status = error.code
        raise
    except Exception:
        error = LLMError("llm_provider_unavailable")
        request_status = error.code
        raise error from None
    finally:
        logger.log(
            logging.INFO if request_status == "ok" else logging.WARNING,
            "LLM request completed" if request_status == "ok" else "LLM request failed",
            extra={
                "request_id": request_id,
                "provider": provider,
                "model": model,
                "duration_ms": int((monotonic() - started_at) * 1000),
                "status": request_status,
                "input_tokens": getattr(response, "input_tokens", None),
                "output_tokens": getattr(response, "output_tokens", None),
            },
        )
    return response
