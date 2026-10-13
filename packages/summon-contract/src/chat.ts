/**
 * The assistant chat protocol between the web app (`useChat`) and the AI service (`apps/ai`).
 *
 * The browser sends only the new message; the AI service loads history and permission-scoped context
 * from Django (`assistantTurnStart`), so a tampered client history can't inject turns. The response is an
 * AI SDK UI message stream typed as `SummonUIMessage`, so the server's writer and the client's renderer
 * agree on every custom part at compile time.
 *
 * The web app imports this module with `import type` only; the schemas are for the AI service.
 */
import type { UIMessage } from "ai";
import { Schema } from "effect";
import { AssistantContextRequest, type AssistantAction, type Citation } from "./client.gen";

/** `POST /ai/workspaces/{slug}/assistant/conversations/{conversationId}/chat` */
export const ChatRequest = Schema.Struct({
  /** Id the client gave the user message; echoed back so the optimistic message is replaced, not duplicated. */
  id: Schema.String,
  text: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(20000)),
  context: Schema.optionalKey(AssistantContextRequest),
  attachment_ids: Schema.optionalKey(Schema.Array(Schema.String).check(Schema.isMaxLength(5))),
});
export type ChatRequest = typeof ChatRequest.Type;

export const chatPath = (workspaceSlug: string, conversationId: string) =>
  `/ai/workspaces/${encodeURIComponent(workspaceSlug)}/assistant/conversations/${encodeURIComponent(conversationId)}/chat`;

/** Sent on `start` and `finish`; the ids are Django `AssistantMessage` ids. */
export const ChatMetadata = Schema.Struct({
  userMessageId: Schema.optionalKey(Schema.String),
  model: Schema.optionalKey(Schema.String),
  inputTokens: Schema.optionalKey(Schema.Number),
  outputTokens: Schema.optionalKey(Schema.Number),
});
export type ChatMetadata = typeof ChatMetadata.Type;

/** Custom `data-*` parts the AI service writes into the stream. */
export type SummonDataParts = {
  /** Records the reply may cite, sent before the first text so the UI can render sources early. */
  citations: { readonly citations: ReadonlyArray<Citation>; readonly truncated: boolean };
  /** A Plane write the model proposed; nothing changed until the user confirms it (existing action endpoints). */
  action: AssistantAction;
};

export type SummonUIMessage = UIMessage<ChatMetadata, SummonDataParts>;

/**
 * Error codes the stream's `error` part carries. The `llm_*` codes are Django's `LLMErrorCode`
 * (`apps/api/plane/app/services/llm.py`), so the UI keeps one copy table for both paths.
 */
export const ChatErrorCode = Schema.Literals([
  "llm_not_configured",
  "llm_authentication_failed",
  "llm_rate_limited",
  "llm_timeout",
  "llm_provider_unavailable",
  "llm_invalid_response",
  "llm_context_too_large",
  /** Django returned a provider the AI service can't drive yet. */
  "llm_provider_unsupported",
  /** Django could not be reached, or refused the turn. */
  "summon_unavailable",
]);
export type ChatErrorCode = typeof ChatErrorCode.Type;
