/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TInstanceLLMProvider = "openai" | "openai_compatible" | "anthropic" | "codex" | "gemini";
export type TInstanceLLMErrorCode =
  | "llm_not_configured"
  | "llm_authentication_failed"
  | "llm_rate_limited"
  | "llm_timeout"
  | "llm_provider_unavailable"
  | "llm_invalid_response"
  | "llm_context_too_large";

export type TInstanceAIConfigurationKeys =
  | "LLM_API_KEY"
  | "LLM_PROVIDER"
  | "LLM_MODEL"
  | "LLM_BASE_URL"
  | "LLM_REQUEST_TIMEOUT_SECONDS";

export type TLLMConnectionTestResult =
  | { status: "ok"; provider: TInstanceLLMProvider; model: string }
  | { status: "error"; code: TInstanceLLMErrorCode };
