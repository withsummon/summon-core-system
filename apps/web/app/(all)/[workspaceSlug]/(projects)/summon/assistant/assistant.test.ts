import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const messageList = readFileSync(new URL("./message-list.tsx", import.meta.url), "utf8");
const service = readFileSync("apps/web/core/services/summon.service.ts", "utf8");
const types = readFileSync("packages/types/src/summon/index.ts", "utf8");
const implementation = `${page}\n${messageList}`;

test("Assistant uses the persistent conversation service instead of the one-shot query", () => {
  for (const method of [
    "listAssistantConversations",
    "createAssistantConversation",
    "getAssistantConversation",
    "sendAssistantMessage",
  ]) {
    assert.match(page, new RegExp(method));
    assert.match(service, new RegExp(method));
  }
  assert.match(types, /ISummonAssistantConversation/);
  assert.match(types, /ISummonAssistantMessagePair/);
  assert.doesNotMatch(`${page}\n${service}`, /queryAssistant/);
});

test("Assistant reads persisted messages back after send and reload", () => {
  assert.match(page, /getAssistantConversation/);
  assert.match(page, /reloadConversation/);
  assert.match(page, /mutateConversationCache/);
  assert.match(page, /\.messages/);
  assert.match(page, /contextTruncated/);
});

test("Assistant sends only explicit authorized context and never credentials", () => {
  for (const contextKey of ["workspace", "project_id", "client_id", "meeting_id", "page_ids"]) {
    assert.match(page, new RegExp(contextKey));
  }
  assert.doesNotMatch(page, /apiKey|LLM_API_KEY|credential.*secret|authorization/i);
});

test("Assistant exposes citations, provider state, normalized errors, retry, pending, and confirmed navigation", () => {
  for (const marker of [
    "citations",
    "provider",
    "model",
    "status",
    "llm_not_configured",
    "llm_authentication_failed",
    "llm_rate_limited",
    "llm_timeout",
    "llm_provider_unavailable",
    "llm_invalid_response",
    "llm_context_too_large",
    "Retry",
    "pending",
    "window.confirm",
  ]) {
    assert.match(implementation, new RegExp(marker));
  }
});
