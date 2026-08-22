# Summon Core PDF Gap Closure Design

## Problem

The supplied `Core System Summon.pdf` contains nine pages and seventeen product screens. The current Plane fork exposes ten Summon routes and a real Django domain, but most authenticated screens are still shallow list/create pages. Several PDF experiences have no dedicated Summon screen, and production route loads currently emit React hydration errors before rendering.

The product must close those functional and visual gaps without deleting, hiding, or duplicating native Plane capabilities. Plane remains the canonical owner of authentication, workspaces, projects, work items, Pages, FileAssets, notifications, members, integrations, and preferences.

The existing AI helper is not genuinely provider-agnostic: it recognizes OpenAI, Anthropic, and Gemini names but sends every request through the OpenAI client without a provider-specific protocol. Summon Assistant and Automation must use a real LLM configured at instance level and continue working when the administrator changes to another supported LLM protocol.

## Outcome

When this work ships:

- Every one of the seventeen PDF screens maps to a real route or interaction state in the web application.
- Home uses the PDF page-6 command-center composition.
- Project Overview uses the project-detail compositions from PDF pages 1 and 2.
- Native Plane features remain available and retain their existing URLs, permissions, persistence, and behavior.
- Summon views reuse canonical Plane records where Plane owns the concept and add persistence only for Summon-owned concepts.
- Summon Assistant, Automation, and meeting summarization use a real instance-configured LLM.
- Switching among OpenAI-compatible, Anthropic, and Gemini protocols requires configuration changes, not frontend or domain-code changes.
- Desktop authenticated pages closely match the PDF hierarchy, density, navigation, cards, tables, charts, side panels, and interaction states.
- Mobile layouts remain usable even though the PDF supplies desktop references only.
- Production navigation completes without React hydration errors or browser-console errors.

## Product and Data Ownership

Plane remains the canonical owner of:

- login, sessions, password reset, OAuth, and request access;
- workspace identity, members, roles, preferences, and integrations;
- projects, project members, work items, assignees, states, priorities, cycles, modules, and views;
- Pages, FileAssets, attachments, and project activity;
- notifications and notification preferences.

`plane.summon` remains the canonical owner of:

- clients, contacts, opportunities, and project commercial profiles;
- meeting metadata, participants, transcript/recording references, summaries, and links to Plane work items;
- Page context and external resource metadata;
- automation templates, runs, and generated-artifact metadata;
- credential vault records, grants, and immutable access audits;
- assistant conversations and messages.

Summon must reference Plane IDs instead of copying Plane records. Summon reports are computed from canonical Plane and Summon records; no report snapshot table is added.

## Screen and Route Map

| PDF reference                     | Required web surface                                                      | Data owner and behavior                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page 1, sign-in                   | Existing Plane sign-in route                                              | Preserve Plane authentication and OAuth; apply Summon visual composition and copy.                                                                               |
| Page 1, workspace/project summary | `/:workspaceSlug/summon/projects/:projectId/`                             | Aggregate Plane Project, Issues, Pages, members, activity, cycles/modules, plus `SummonProjectProfile`, meetings, and resources.                                 |
| Page 2, project overview          | Same project route, Overview tab                                          | Functional Overview, Tasks, Milestones, Documents, Repositories, Deployments, Activity, Notes, More tabs. Native Plane routes remain the final editing surfaces. |
| Page 2, Knowledge                 | `/:workspaceSlug/summon/knowledge/`                                       | Search and categorize authorized Plane Pages plus `SummonPageContext`; no copied page content.                                                                   |
| Page 3, Management & Reporting    | Existing `/:workspaceSlug/summon/reports/`                                | Live portfolio, delivery, commercial, knowledge, meeting, and automation aggregates with filters and export.                                                     |
| Page 3, Client profile            | `/:workspaceSlug/summon/clients/:clientId/`                               | Client, contacts, linked opportunities, linked Plane projects, notes, Pages, and activity.                                                                       |
| Page 4, Credential Vault          | Existing credentials route and detail drawer                              | Real encrypted create, reveal, rotate, grant, revoke, audit, search, filters, and status metrics.                                                                |
| Page 4, command palette           | Existing Plane Power-K dialog                                             | Preserve all native commands; add Summon navigation and create/generate actions.                                                                                 |
| Page 5, Settings                  | Existing Summon settings route                                            | Summon overview over native Plane settings, AI configuration status, credential/security policies, and links to canonical edit screens.                          |
| Page 5, Opportunities             | Existing list plus `/:workspaceSlug/summon/opportunities/:opportunityId/` | Searchable pipeline and detail with stage transition, client/contact context, Pages, work items, meetings, and generation actions.                               |
| Page 6, Home                      | Existing `/:workspaceSlug/summon/`                                        | Command center with priority, company snapshot, project health, activity, quick access, meetings, and calendar.                                                  |
| Page 6, Resources                 | Existing resources route                                                  | Unified authorized index for external resources and linked Plane Pages/FileAssets; uploads still use Plane.                                                      |
| Page 7, Automation Studio         | Existing automation route                                                 | Real LLM-assisted document generation, template selection, jobs, previews, and Plane Page/FileAsset outputs.                                                     |
| Page 7, Summon Assistant          | Existing assistant route                                                  | Persistent multi-turn conversation over explicitly selected authorized context, with citations and actions.                                                      |
| Page 8, Task Center               | `/:workspaceSlug/summon/tasks/`                                           | Summon-oriented view over Plane Issues with native issue editing links; no Summon task model.                                                                    |
| Page 9, Meeting Workspace         | Existing meeting list plus `/:workspaceSlug/summon/meetings/:meetingId/`  | Recording, supplied transcript, AI summary, decisions, participants, related Pages, and Plane action items.                                                      |
| Page 9, Notifications             | `/:workspaceSlug/summon/notifications/`                                   | Summon-oriented view over native Plane notifications; native Inbox remains available.                                                                            |

`/:workspaceSlug/summon/documents/` is also added because Documents is a persistent PDF navigation item. It is an authorized index over Plane Pages and FileAssets and links to native Plane editing surfaces.

## Navigation and Shell

- Keep Plane's top bar, workspace switcher, native sidebar items, project navigation, and native routes.
- Keep one open-by-default Summon Core section in the Plane sidebar; do not duplicate it in the extended menu.
- Order Summon entries to match the PDF: Home, Projects, Opportunities, Clients, Tasks, Documents, Knowledge, Resources, Automation Studio, Credentials, Reports, Notifications, and Settings.
- Summon Assistant remains a visually distinct persistent action at the bottom of the Summon section.
- On desktop, the sidebar can still be collapsed through Plane's native control. The expanded state is the visual acceptance baseline because that state corresponds to the PDF.
- On mobile, retain Plane's native drawer behavior rather than introducing another navigation implementation.

## Frontend Composition

The current generic `SummonMetric + SummonRecordList + form` pattern remains available for simple states but must not dictate every page. Shared Summon components cover only repeated visual primitives:

- page header and global/contextual actions;
- metric card;
- compact table shell and filter bar;
- progress ring using CSS `conic-gradient`;
- horizontal progress and pipeline bars;
- status badge;
- activity list;
- contextual right rail;
- loading, populated, empty, validation-error, permission-error, and request-error states.

No chart dependency is added. Donut, progress, and pipeline visuals use CSS and small native SVG where CSS is insufficient. Existing `@plane/ui`, theme tokens, icons, dialogs, drawers, and form controls are reused.

Page-specific components live next to their route when used once. A component moves to `apps/web/core/components/summon/` only after at least two real routes share the same behavior.

No production mock records or hard-coded PDF numbers are allowed. Browser visual tests use deterministic test fixtures so populated-state fidelity can be evaluated without polluting production data.

## Core User Flows

### Home and Project

1. A member opens Summon Home and sees live priority work items, project counts, project health, recent activity, upcoming meetings, and quick access.
2. Selecting a project opens Summon Project Overview.
3. Overview tabs either render a Summon aggregate or link into the canonical Plane feature for editing.
4. Refreshing or directly opening the project URL restores the same selected project and live state.

### Clients and Opportunities

1. A member creates or selects a client.
2. Client detail displays contacts, opportunities, and linked Plane projects.
3. A member creates an opportunity, updates its stage/probability, and associates Pages, meetings, or an existing Plane project.
4. All writes survive reload and remain workspace-scoped.

### Tasks, Documents, Knowledge, Resources, and Notifications

1. Summon presents PDF-style indexes and summaries.
2. Reads and mutations use Plane APIs for Plane-owned records.
3. Editing a work item, Page, FileAsset, notification preference, or project opens the existing Plane surface.
4. Summon adds filters, cross-domain context, and navigation without copying the canonical record.

### Meetings

1. A member schedules a meeting and optionally links a Plane project.
2. The member adds participants and links an existing recording FileAsset and a transcript supplied as text or a text FileAsset.
3. The member explicitly requests AI summarization.
4. Summon sends only the authorized transcript and selected context to the configured LLM.
5. Validated decisions and action-item suggestions are displayed before the user creates or links Plane work items.
6. The summary is saved to the meeting's canonical Plane Page and survives reload.

Automatic speech-to-text is not included. The meeting page plays an attached recording and summarizes a supplied transcript. A speech-to-text provider is a separate product decision.

### Automation

1. A member selects a template, project/client context, output type, title, and explicit source context.
2. The backend builds a bounded prompt from authorized records and requests structured output from the LLM.
3. The response is validated against the selected template contract.
4. Summon shows a preview before publishing.
5. Publishing creates a canonical Plane Page. File export uses an existing Plane-supported FileAsset/export path when available; unsupported output types remain visibly unavailable instead of producing fake files.
6. Job status, provider, model, sanitized error, and token usage survive reload.

### Assistant

1. A member starts or resumes a conversation.
2. The user selects workspace, project, client, meeting, or Page context; Summon never silently sends the entire workspace.
3. The backend retrieves only records the user can access and sends a size-bounded context to the LLM.
4. The response contains human-readable citations that link back to canonical Plane/Summon records.
5. Supported actions, such as opening a project, drafting a Page, or preparing a proposal, require an explicit user click before creating data.
6. Conversation history is persisted and scoped to its owner and workspace.

## Provider-Agnostic LLM Architecture

### Instance configuration

Reuse Plane's encrypted instance configuration and retain backward compatibility with existing variables:

- `LLM_API_KEY`: encrypted secret, required for hosted providers;
- `LLM_PROVIDER`: `openai`, `openai_compatible`, `anthropic`, or `gemini`;
- `LLM_MODEL`: administrator-supplied model identifier, not a hard-coded allowlist;
- `LLM_BASE_URL`: optional server-controlled base URL for OpenAI-compatible providers;
- `LLM_REQUEST_TIMEOUT_SECONDS`: integer from 5 through 120, default 60.

No API endpoint accepts an API key, base URL, or provider override from an ordinary workspace request. The frontend receives only configured/not-configured status, provider label, model, and health-check result.

### Provider contract

Summon uses one internal request/response contract:

```python
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
    input_tokens: int | None
    output_tokens: int | None
```

The provider boundary exposes `generate(request: LLMRequest) -> LLMResponse`.

- `OpenAICompatibleProvider` uses the already-installed OpenAI client and an optional instance-controlled `base_url`. It covers OpenAI and compatible endpoints such as OpenRouter, Groq, Together, Mistral, self-hosted gateways, and Ollama-compatible deployments.
- `AnthropicProvider` uses the native Anthropic Messages HTTP contract through the already-installed `requests` package.
- `GeminiProvider` uses the native Gemini `generateContent` HTTP contract through `requests`.

No vendor SDK is added. Provider responses are normalized at the boundary. Authentication, rate limit, timeout, malformed response, unsupported model, and provider outage errors map to stable Summon error codes and safe user messages.

The current static model allowlists are removed. Administrators can enter a model identifier and use an admin-only connection test. A failed connection test never saves or logs the API key.

### Safety and privacy

- Never include credentials, secret fields, password values, browser state, or API keys in prompts.
- Context retrieval reuses the same workspace/project permission filters as the underlying API.
- Each request has a maximum of 30,000 characters of selected source context before provider-specific tokenization. Excess context is truncated by ranked relevance, with the truncation disclosed in the response.
- Only an explicit user action invokes the LLM. Dashboard page loads never transmit workspace data.
- Store conversation text because the PDF requires recent conversations, but do not store API keys, provider authorization headers, or complete upstream response envelopes.
- Application logs contain request IDs, provider, model, duration, status, and token counts only. They do not contain prompt or response bodies.
- If the provider is unavailable, existing deterministic summaries remain available where they can answer truthfully. The UI labels this as degraded mode and never presents deterministic output as an LLM response.

## Assistant Persistence

Add exactly two Summon-owned models:

- `AssistantConversation`: workspace, owner, optional Plane project, optional client, title, and last activity timestamp.
- `AssistantMessage`: conversation, role (`user` or `assistant`), content, citations JSON, provider, model, input/output token counts, and status.

Messages are append-only through the public API. Deleting a conversation uses the repository's normal soft-delete behavior. A user can read only conversations they own unless a later, separately approved sharing feature is added.

Update `docs/architecture/summon-domain-ownership.md` and the model allowlist test in the same schema change. No general prompt-template, vector-store, tool registry, or agent model is added.

## API and Service Changes

- Extend report summaries with project health, stage pipeline, due-date buckets, upcoming meetings, recent activity, and chart-ready series derived from canonical records.
- Expose project overview aggregation as one workspace/project-scoped endpoint to avoid many inconsistent browser requests.
- Use existing CRUD endpoints for clients, contacts, opportunities, meetings, resources, templates, credentials, and project profiles; add detail actions only where the existing service already exposes backend behavior but the UI cannot invoke it.
- Add meeting participant, transcript association, summary generation, and summary read-back actions.
- Add assistant conversation/message endpoints and an explicit send-message action.
- Split automation into generate-preview and publish actions. Preview never creates a Page; publish creates exactly one canonical artifact and is idempotent per successful job.
- Add an admin-only LLM status/connection-test endpoint that returns no secret material.
- Keep all custom endpoints below `/api/summon/workspaces/<slug>/` except instance-level AI configuration, which remains in Plane's instance administration boundary.

## Permissions

- Plane Admin and Member roles can mutate ordinary Summon records; Guest remains read-only where current policy permits.
- Summon Settings remains workspace-Admin-only. Provider, model, base URL, timeout, API key, and connection testing are visible and mutable only to Plane instance administrators through the instance administration boundary.
- Project aggregates require active access to the referenced Plane project.
- Assistant conversations require workspace membership and conversation ownership.
- Credential reveal, rotation, grants, and audit retain their current password confirmation and grant rules.
- LLM calls cannot broaden access: every included record must pass the same permission filter as a direct API read by the requesting user.

## Error Handling

Every route must provide distinct loading, populated, empty, validation-error, permission-error, and retryable-request-error states.

AI errors are normalized to:

- `llm_not_configured`;
- `llm_authentication_failed`;
- `llm_rate_limited`;
- `llm_timeout`;
- `llm_provider_unavailable`;
- `llm_invalid_response`;
- `llm_context_too_large`.

The UI displays a specific recovery action without exposing upstream response bodies or credentials. Automation and meeting-summary failures persist a sanitized error and remain retryable. Repeated retries do not create duplicate Pages or FileAssets.

## Visual Acceptance

The PDF is the visual source of truth. Acceptance is evaluated at a 1440 by 900 desktop viewport with the Plane sidebar expanded. Each screen must match the corresponding reference in:

- information hierarchy and content grouping;
- page header, global search, actions, and right-side controls;
- sidebar order and active states;
- column count and relative widths;
- card, table, chart, activity, and right-rail composition;
- blue accent, light canvas, borders, shadows, radii, typography scale, and spacing rhythm;
- populated, empty, loading, and error states.

Exact names, dates, counts, avatars, and business values come from live/test data and are not copied from the PDF.

At 390 by 844, every flow must remain operable: navigation uses Plane's drawer, tables scroll or collapse without clipping actions, drawers fit the viewport, and forms remain keyboard-accessible.

Accessibility basics are required: semantic headings, labeled fields, keyboard navigation, visible focus, dialog semantics, no color-only status, and readable contrast.

## Verification

Each independently shipped phase must include:

- focused frontend unit tests for non-trivial transformations and interaction state;
- focused Django contract/service tests for permissions, validation, persistence, idempotency, and cross-workspace isolation;
- `pnpm --filter web check:types` and the nearest changed-package type checks;
- changed-path lint/format checks and `git diff --check`;
- a production web build;
- one authenticated browser flow with real clicks, direct-route reload, and console inspection;
- desktop and mobile screenshots for each changed PDF screen;
- read-back verification after every create/update/generate/publish flow.

Provider verification consists of:

- deterministic contract tests for the OpenAI-compatible, Anthropic, and Gemini adapters using HTTP-boundary stubs;
- invalid-key, rate-limit, timeout, malformed-response, and missing-configuration tests;
- one live smoke using the currently configured real provider without recording its key or response body in logs or screenshots;
- changing provider configuration and rerunning the same assistant request without frontend changes.

Release acceptance requires all seventeen PDF screen mappings to be exercised, native Plane Projects/Issues/Pages/Inbox/Settings to remain reachable, and zero browser-console errors on the tested paths.

## Delivery Sequence

1. **Runtime baseline:** reproduce and remove hydration errors; capture authenticated visual baselines and stable populated fixtures.
2. **Shared shell and navigation:** add the complete Summon route map and reusable visual primitives without altering native Plane navigation.
3. **Home and Project Overview:** implement the two approved primary compositions and their aggregate API.
4. **Plane-backed indexes:** implement Tasks, Documents, Knowledge, Resources, and Notifications over canonical Plane data.
5. **Commercial workflows:** complete Clients and Opportunities list/detail flows and project profile editing.
6. **Operations and security:** complete Meeting list/detail, Credential Vault, Settings, and command-palette actions.
7. **LLM provider boundary:** replace the current pseudo-multi-provider helper with the normalized instance-level adapters and connection test.
8. **AI product flows:** implement Automation preview/publish, persistent Assistant conversations, and meeting summarization.
9. **Reporting:** implement PDF-matched portfolio, commercial, delivery, knowledge, meeting, and automation visualizations and exports.
10. **Release hardening:** complete desktop/mobile visual comparison, permissions, read-back UAT, regression checks, and production convergence verification.

Each sequence item must ship working, testable software. Later phases may consume earlier APIs, but no phase may leave a public route as a non-functional placeholder.

## Non-Goals

- Removing or visually hiding native Plane features.
- Creating Summon Project, Task, Page, File, Notification, User, Workspace, or general Settings models.
- Copying the PDF's sample business records into production.
- Supporting an arbitrary proprietary LLM protocol without an adapter. "Provider-agnostic" means the product contract is independent and the three approved protocols are implemented.
- Automatic speech-to-text.
- Autonomous background agents that mutate data without an explicit user action.
- Vector database, embeddings, semantic indexing, or RAG infrastructure before authorized keyword/context retrieval is proven insufficient.
- New frontend, chart, AI-provider, or workflow dependencies when the existing stack can implement the requirement.

## Commitments

- Home follows PDF page 6; Project Overview follows PDF pages 1 and 2.
- Native Plane capabilities remain available throughout the migration.
- All seventeen PDF screens are functional web acceptance targets, not decorative mockups.
- LLM configuration is instance-level and encrypted.
- Supported LLM protocols are OpenAI-compatible, Anthropic, and Gemini.
- The model name is administrator-configurable and not restricted to a stale hard-coded list.
- Summon transmits only explicitly selected, authorized context to an LLM.
- Generated content is previewed before persistence and always stored in canonical Plane Pages/FileAssets.
- No implementation begins until this design is approved and converted into a task-level implementation plan.
