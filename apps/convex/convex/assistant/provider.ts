import { z } from "zod/v4";
import { convexToZod } from "convex-helpers/server/zod4";
import { v } from "convex/values";
import { encryptedFields } from "../webhooks/schema";

export const aiProvider = z.enum(["openai", "openai_compatible", "anthropic", "codex", "gemini"]);
export const aiProviderNames = {
  openai: "OpenAI",
  openai_compatible: "OpenAI-compatible",
  anthropic: "Anthropic",
  codex: "Codex (ChatGPT account)",
  gemini: "Gemini",
};
const endpoint = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  }, "Use an http or https endpoint without embedded credentials.");
export const aiFields = z.object({
  provider: aiProvider,
  model: z.string().trim().min(1).max(255),
  baseUrl: z.union([endpoint, z.literal("")]),
  timeout: z.number().int().min(5).max(120),
  codexBridgeUrl: endpoint.nullable(),
});
export const aiConfiguration = aiFields.extend({ key: z.string().min(1).max(8192).nullable() });
export const runtimeAiConfiguration = z.union([
  aiConfiguration.extend({ provider: aiProvider.exclude(["codex"]), key: z.string().min(1) }),
  aiConfiguration.extend({ provider: z.literal("codex"), key: z.null() }),
]);
export const storedAiConfiguration = aiFields.extend({ key: convexToZod(v.object(encryptedFields)).nullable() });
export const aiSave = aiFields
  .omit({ codexBridgeUrl: true })
  .extend({
    expectedRevision: z.number().int().min(1),
    key: z.string().max(8192).optional(),
  })
  .refine((value) => value.provider !== "codex" || value.model.length <= 100, "Codex model is too long.");
export function aiConfigured(config: z.infer<typeof aiConfiguration> | z.infer<typeof storedAiConfiguration>) {
  return config.provider === "codex"
    ? config.codexBridgeUrl !== null
    : config.key !== null && (config.provider !== "openai_compatible" || config.baseUrl !== "");
}
export function operatorAiConfiguration(env: Record<string, string | undefined>) {
  const provider = env.LLM_PROVIDER?.trim().toLowerCase() || "openai";
  return aiConfiguration.parse({
    provider,
    model: env.LLM_MODEL?.trim() || env.GPT_ENGINE?.trim() || "gpt-4o-mini",
    key: env.LLM_API_KEY?.trim() || null,
    baseUrl: provider === "openai_compatible" ? env.LLM_BASE_URL?.trim() || "" : "",
    timeout: Number(env.LLM_REQUEST_TIMEOUT_SECONDS ?? "60"),
    codexBridgeUrl: env.CODEX_BRIDGE_URL?.trim() || null,
  });
}
export const llmErrorCode = z.enum([
  "llm_not_configured",
  "llm_authentication_failed",
  "llm_rate_limited",
  "llm_timeout",
  "llm_provider_unavailable",
  "llm_invalid_response",
  "llm_context_too_large",
]);
export const aiTestResult = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), provider: aiProvider, model: z.string() }),
  z.object({ status: z.literal("error"), code: llmErrorCode }),
]);
const errorMessages = {
  llm_not_configured: "The instance LLM is not configured.",
  llm_authentication_failed: "The LLM provider rejected its credentials.",
  llm_rate_limited: "The LLM provider rate limit was reached. Try again later.",
  llm_timeout: "The LLM provider timed out. Try again.",
  llm_provider_unavailable: "The configured LLM provider is unavailable.",
  llm_invalid_response: "The LLM provider returned an invalid response.",
  llm_context_too_large: "The selected context is too large for the LLM provider.",
};
export class LLMError extends Error {
  constructor(readonly code: z.infer<typeof llmErrorCode>) {
    super(errorMessages[code]);
  }
}
const openAiEvent = z.object({
  choices: z.array(
    z.object({
      delta: z.object({ content: z.string().nullish(), tool_calls: z.null().optional() }),
      finish_reason: z.literal("stop").nullish(),
    })
  ),
});
const anthropicEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("content_block_delta"),
    delta: z.object({ type: z.literal("text_delta"), text: z.string() }),
  }),
  z.object({
    type: z.literal("message_delta"),
    delta: z.object({ stop_reason: z.enum(["end_turn", "stop_sequence"]).nullable() }),
  }),
  z.object({ type: z.literal("message_stop") }),
  z.object({ type: z.literal("message_start") }),
  z.object({
    type: z.literal("content_block_start"),
    content_block: z.object({ type: z.literal("text"), text: z.string() }),
  }),
  z.object({ type: z.literal("content_block_stop") }),
  z.object({ type: z.literal("ping") }),
  z.object({
    type: z.literal("error"),
    error: z.object({
      type: z.enum([
        "authentication_error",
        "permission_error",
        "rate_limit_error",
        "overloaded_error",
        "api_error",
        "invalid_request_error",
        "not_found_error",
        "request_too_large",
      ]),
    }),
  }),
]);
const geminiEvent = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({ parts: z.array(z.object({ text: z.string(), thought: z.boolean().optional() })) })
          .optional(),
        finishReason: z.literal("STOP").optional(),
      })
    )
    .optional(),
});
export function parseDelta(provider: z.infer<typeof aiProvider>, data: string) {
  const raw: unknown = JSON.parse(data);
  if (provider === "anthropic") {
    const event = anthropicEvent.parse(raw);
    if (event.type === "error")
      throw new LLMError(
        event.error.type === "authentication_error" || event.error.type === "permission_error"
          ? "llm_authentication_failed"
          : event.error.type === "rate_limit_error"
            ? "llm_rate_limited"
            : event.error.type === "request_too_large"
              ? "llm_context_too_large"
              : "llm_provider_unavailable"
      );
    return {
      content:
        event.type === "content_block_delta"
          ? event.delta.text
          : event.type === "content_block_start"
            ? event.content_block.text
            : "",
      finished: event.type === "message_delta" && event.delta.stop_reason !== null,
      terminal: event.type === "message_stop",
    };
  }
  if (provider === "gemini") {
    const choice = geminiEvent.parse(raw).candidates?.[0];
    return {
      content:
        choice?.content?.parts
          .filter((part) => !part.thought)
          .map((part) => part.text)
          .join("") ?? "",
      finished: choice?.finishReason === "STOP",
      terminal: false,
    };
  }
  const choice = openAiEvent.parse(raw).choices[0];
  return { content: choice?.delta.content ?? "", finished: choice?.finish_reason === "stop", terminal: false };
}
async function providerBody(response: Response) {
  if (!response.body) throw new LLMError("llm_invalid_response");
  const reader = response.body.getReader(),
    decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "",
    size = 0;
  try {
    while (true) {
      // The external byte budget is checked before retaining each sequential chunk.
      // oxlint-disable-next-line no-await-in-loop
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 1_048_576) throw new LLMError("llm_invalid_response");
      text += decoder.decode(next.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
function providerEndpoint(base: string, path: string) {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/\/$/, "") + path;
  return url.href;
}
function providerRequest(
  config: z.infer<typeof runtimeAiConfiguration>,
  messages: { role: "system" | "user" | "assistant"; content: string }[]
) {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");
  const conversation = messages.filter((message) => message.role !== "system");
  let url: string, headers: Record<string, string>, payload: unknown;
  switch (config.provider) {
    case "anthropic":
      url = "https://api.anthropic.com/v1/messages";
      headers = { "x-api-key": config.key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" };
      payload = {
        model: config.model,
        max_tokens: 4096,
        system,
        messages: conversation,
        temperature: 0.2,
        stream: true,
      };
      break;
    case "gemini":
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:streamGenerateContent?alt=sse`;
      headers = { "x-goog-api-key": config.key, "Content-Type": "application/json" };
      payload = {
        systemInstruction: { parts: [{ text: system }] },
        contents: conversation.map((message) => ({
          role: message.role === "assistant" ? "model" : message.role,
          parts: [{ text: message.content }],
        })),
        generationConfig: { temperature: 0.2 },
      };
      break;
    case "codex":
      if (!config.codexBridgeUrl || config.model.length > 100) throw new LLMError("llm_not_configured");
      url = providerEndpoint(config.codexBridgeUrl, "/generate");
      headers = { "Content-Type": "application/json" };
      payload = { model: config.model, system, messages: conversation, response_schema: null };
      break;
    default:
      url = providerEndpoint(
        config.provider === "openai" ? "https://api.openai.com/v1" : config.baseUrl,
        "/chat/completions"
      );
      headers = { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" };
      payload = { model: config.model, messages, temperature: 0.2, stream: true };
  }
  return { url, headers, payload };
}
async function* streamEvents(response: Response, provider: z.infer<typeof aiProvider>) {
  if (!response.body) throw new LLMError("llm_invalid_response");
  const reader = response.body.getReader(),
    decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "",
    size = 0,
    finished = false,
    terminal = false;
  try {
    while (!terminal) {
      // Stream reads are ordered and cannot run concurrently.
      // oxlint-disable-next-line no-await-in-loop
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 1_048_576) throw new LLMError("llm_invalid_response");
      buffer += decoder.decode(next.value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";
      for (const event of events) {
        const fields = event.split(/\r?\n/).filter((line) => line.startsWith("data:"));
        if (!fields.length) continue;
        const data = fields
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n")
          .trim();
        if (data === "[DONE]") {
          if (provider !== "openai" && provider !== "openai_compatible") throw new LLMError("llm_invalid_response");
          terminal = true;
          break;
        }
        const delta = parseDelta(provider, data);
        finished ||= delta.finished;
        terminal ||= delta.terminal;
        if (delta.content) yield delta.content;
      }
    }
    if (!finished || (provider !== "gemini" && !terminal)) throw new LLMError("llm_invalid_response");
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
export async function* streamProvider(
  config: z.infer<typeof runtimeAiConfiguration>,
  messages: Parameters<typeof providerRequest>[1],
  signal: AbortSignal
) {
  if (!aiConfigured(config)) throw new LLMError("llm_not_configured");
  const { url, headers, payload } = providerRequest(config, messages);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal,
      redirect: "error",
    });
    if (!response.ok) {
      const detail = await providerBody(response);
      const contextOverflow = [
        "context_length_exceeded",
        "context window",
        "prompt is too long",
        "request too large",
        "token limit",
        "too many tokens",
      ].some((marker) => detail.toLowerCase().includes(marker));
      throw new LLMError(
        response.status === 413 || contextOverflow
          ? "llm_context_too_large"
          : response.status === 401 || response.status === 403
            ? "llm_authentication_failed"
            : response.status === 429
              ? "llm_rate_limited"
              : response.status === 408 || response.status === 504
                ? "llm_timeout"
                : "llm_provider_unavailable"
      );
    }
    if (config.provider === "codex") {
      const result = z.object({ text: z.string().min(1) }).parse(JSON.parse(await providerBody(response)));
      yield result.text;
    } else yield* streamEvents(response, config.provider);
  } catch (failure) {
    if (failure instanceof LLMError) throw failure;
    if (signal.aborted) throw new LLMError("llm_timeout");
    throw new LLMError(
      failure instanceof z.ZodError || failure instanceof SyntaxError
        ? "llm_invalid_response"
        : "llm_provider_unavailable"
    );
  }
}
