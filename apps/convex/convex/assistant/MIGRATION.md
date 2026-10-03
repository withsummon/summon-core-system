# Assistant vertical slice

## Production ownership

Native conversation/message/action tables replace the Django assistant persistence boundary for the new Convex client. Conversations are private to their creator and require current workspace membership. `context.ts` owns bounded explicit source collection through the existing project/client/meeting/document access owners. Context is fixed after the first message; a new conversation is required to change it, so history cannot silently carry old source content into a different permission context. Message reads reauthorize that context.

`POST /assistant/reply` authenticates the Convex JWT and returns SSE events (`message`, `delta`, `done`, `error`). `messages.begin` atomically stores the user message and pending assistant response; request IDs are accepted once and duplicate requests return a conflict rather than generating again. Only one response per conversation may run. Native subscriptions read the persisted batches. Cancellation rejects late batches. A crashed request can be cancelled through `cancelReply` before starting another.

Every batch and final completion rechecks current conversation and source permissions before persistence or HTTP publication. Source selection is bounded to 20 documents and 30,000 context characters; history is at most 40 rows/60,000 characters, user messages 20,000 characters, replies 100,000. Source content is explicitly marked as untrusted data in the provider prompt. Stream events are bounded to 1 MiB and the configured timeout is 5–120 seconds.

## Real provider adapter and configuration

The server reads `LLM_API_KEY`, `LLM_PROVIDER` (`openai` or `openai_compatible`), `LLM_MODEL` (fallback `GPT_ENGINE`, then `gpt-4o-mini`), `LLM_BASE_URL` for compatible providers, and `LLM_REQUEST_TIMEOUT_SECONDS` (default 60). These follow the legacy Django LLM contract. Keys remain server environment values and are not persisted in conversations, messages, or errors. Compatible endpoints must implement streaming Chat Completions SSE. Provider failures and malformed/incomplete streams fail the stored reply; no deterministic fabricated reply is substituted.

The local presence-only inspection found no configured API key. **Live provider behavior is unverified.** Tests replace the actual fetch transport with deterministic SSE responses; they do not claim provider latency, accuracy, cost, or deployment success.

## Explicit writes

The only migrated write proposal is task status. `actions.propose` stores an exact preview and task version without modifying the task. `actions.confirm` is a separate authenticated mutation: it rechecks current context and project write access, rejects a changed task, then executes the canonical `tasks/status.ts` owner and marks the action completed in one transaction. Repeated confirmation does not duplicate events. The model receives no tool definitions and returned tool calls are rejected. The UI must display the pending preview and require an explicit user confirmation.

## Verification and remaining parity

Behavior tests live in `__tests__`: owner isolation, request deduplication, concurrent reply exclusion, cancellation, context immutability, project/document revocation during generation, persisted SSE completion, unavailable provider, malformed/truncated provider streams, no model tool execution, explicit approval, stale preview rejection, and context changes before approval. Existing task tests exercise the extracted status owner without behavior changes.

Not migrated in this slice: automatic retrieval/search ranking, legacy assistant attachments and OCR, token usage/cost accounting, MCP credential-bound invocation, other tool operations, deterministic intent handlers, automation jobs, generated document outputs, Anthropic/Gemini/Codex bridge providers, and meeting-specific summary generation. `inputTokens`/`outputTokens` remain null rather than invented. No Django retirement or live provider success is claimed here.
