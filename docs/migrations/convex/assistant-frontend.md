# Native assistant frontend slice

## Experience and ownership

The module helps workspace members discuss explicitly selected work and review a task change before applying it. Existing Summon assistant components were inspected: conversation sidebar, message list, context disclosure, composer keyboard behavior, and action cards. The keyboard helper is reused directly. Django-shaped messages, attachment services, and MCP adapters are not imported into the native module.

A conversation rail plus transcript was selected over a single list/detail screen because users need to return to earlier discussions while continuing their current one. The rail collapses above the transcript at constrained widths. Context choices remain in settings; task actions are separate from prose and require a preview followed by an explicit confirmation.

Inspected reference images:

- [ChatGPT conversation and sources panel](https://mobbin.com/screens/88d5e839-cf2b-447b-887c-a4beeead8040): persistent conversation navigation and subordinate source disclosure. Adapted to a compact inline source list rather than another permanent rail.
- [Customer.io agent conversation](https://mobbin.com/screens/fafcbfb9-fa85-4b4d-b17f-54df962305b5): recent chats beside a focused transcript and composer. Its product-wide navigation was not copied.
- [ElevenLabs confirmation](https://mobbin.com/screens/28448177-b348-40b4-ab52-13f3aa9893bf): the visible action and consequence precede confirmation. This is a generic archive confirmation, not evidence of an AI execution workflow. The native task preview instead shows the task and before/after status.

| Existing constraint                                      | Implementation decision                                           | Acceptance condition                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| Legacy assistant uses Django-shaped contracts            | Generated Convex conversation, message and action owners          | No Django request in native assistant flow                        |
| Provider output and data writes have different authority | Canonical message subscription; separate persisted action preview | Sending prose cannot mutate a task; confirm is explicit           |
| Context may become inaccessible                          | Backend context ACL plus local conversation boundary              | Revocation removes transcript without losing workspace navigation |
| Conversation history can cross source changes            | Source settings disable after first message                       | Start a new conversation to change context                        |

## Supported contracts

Conversation IDs in deep links are normalized at the backend. Lists and messages are paginated; selected detail is a canonical query. Projects, clients, meetings, documents, and tasks are chosen from authorized typed results. The backend owns privacy, context budgets, status changes, and conflict detection.

The authenticated HTTP reply is consumed as transport. Text is rendered exclusively from persisted message subscriptions, avoiding a competing optimistic transcript cache. The draft clears only after an accepted response. A missing provider returns its actual 503 error and retains the draft. Cancellation stops both the canonical reply and the active browser transport. Leaving the conversation aborts its transport.

Task status proposals are user-created previews, not model-generated tool calls. Confirm and cancel use the persisted action ID. The preview warns that changing the coarse status group clears custom state. A stale task revision is rejected by the backend.

## Verification and limits

Three module-local HTTP behavior tests cover provider-not-configured draft retention, authenticated request/transport ownership, and stream cancellation. Focused lint passes; native web types pass. These tests use a local fixture HTTP endpoint and are not real provider evidence. Primary Chrome acceptance remains a separate gate.

No provider credential is configured by this slice. Real provider output, streamed model accuracy, and provider cost are unverified. Generic attachments, MCP credential management, provider settings, model-generated proposals, automatic RAG, rich Markdown output, and all legacy assistant tools are outside this slice. Sources are shown as labels, not fabricated navigation links. This is not full legacy assistant parity.

## Primary browser acceptance

Chrome created a private conversation. The actual unconfigured-provider endpoint returned 503, and the composer retained the draft. A task-status preview followed by explicit confirmation updated the other browser tab's task subscription to In progress. The completed action persisted after reload. A different authenticated localhost user received the conversation-unavailable state and had no conversation listing entry. No live LLM reply was produced or verified.

The primary run also executed all ten document-asset and assistant transport behavior tests successfully. Independent backend-owner review identified a stale action-project selection after changing an empty conversation's context; the frontend now derives a scoped project from current canonical context and keeps local project selection only for unscoped conversations.
