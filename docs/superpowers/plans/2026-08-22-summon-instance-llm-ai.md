# Summon Instance LLM and AI Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pseudo-multi-provider helper with real instance-level OpenAI-compatible, Anthropic, and Gemini adapters, then power persistent Assistant, Automation preview/publish, and meeting summarization.

**Architecture:** Put one normalized LLM boundary in Plane's shared app layer so native Plane AI and Summon consume the same configuration and protocol adapters. Keep credentials in encrypted instance configuration, add exactly two Assistant persistence models, and require explicit authorized context plus user confirmation before any generated content is persisted.

**Tech Stack:** Django 5, Django REST Framework, PostgreSQL, OpenAI Python client 1.63.2, Requests 2.33.0, React 19, React Router 7, TypeScript, SWR, Plane admin/web apps.

**Spec:** `docs/superpowers/specs/2026-08-22-summon-core-pdf-gap-closure-design.md`

## Global Constraints

- Instance keys are `LLM_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL`, `LLM_BASE_URL`, and `LLM_REQUEST_TIMEOUT_SECONDS`.
- Provider values are `openai`, `openai_compatible`, `anthropic`, and `gemini`; timeout is an integer from 5 through 120 with default 60.
- API key remains encrypted and is never returned, logged, screenshotted, or accepted through ordinary workspace endpoints.
- Model identifiers are administrator-supplied; remove the stale hard-coded allowlist.
- Maximum selected source context is 30,000 characters; truncated context is disclosed.
- Add no vendor SDK, vector database, embedding service, autonomous mutation, or background agent.
- Generated content is previewed before persistence and published only to canonical Plane Page/FileAsset records.

---

### Task 1: Normalized real-provider boundary

**Files:**

- Create: `apps/api/plane/app/services/__init__.py`
- Create: `apps/api/plane/app/services/llm.py`
- Modify: `apps/api/plane/app/views/external/base.py`
- Modify: `apps/api/plane/utils/instance_config_variables/core.py`
- Create: `apps/api/plane/tests/unit/services/__init__.py`
- Create: `apps/api/plane/tests/unit/services/test_llm.py`

**Interfaces:**

- Consumes: encrypted Plane instance configuration, installed `openai` client, installed `requests`.
- Produces: `LLMRequest`, `LLMResponse`, `LLMError`, `get_llm_config()`, `get_llm_provider()`, and `generate(request)`.

- [ ] **Step 1: Write failing provider-normalization tests**

```python
import requests

from plane.app.services.llm import LLMRequest, generate


class FakeResponse:
    def __init__(self, data, status_code=200):
        self.data = data
        self.status_code = status_code

    def json(self):
        return self.data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(response=self)


def test_anthropic_uses_messages_contract(monkeypatch):
    seen = {}
    monkeypatch.setattr("plane.app.services.llm.get_llm_config", lambda: {"provider": "anthropic", "model": "claude-test", "api_key": "secret", "base_url": "", "timeout": 60})
    monkeypatch.setattr("plane.app.services.llm.requests.post", lambda url, **kwargs: seen.update(url=url, kwargs=kwargs) or FakeResponse({"content": [{"type": "text", "text": "ok"}], "usage": {"input_tokens": 2, "output_tokens": 1}}))
    response = generate(LLMRequest(system="system", messages=[{"role": "user", "content": "hello"}]))
    assert seen["url"].endswith("/v1/messages")
    assert seen["kwargs"]["headers"]["x-api-key"] == "secret"
    assert response.text == "ok"


def test_gemini_uses_generate_content_contract(monkeypatch):
    seen = {}
    monkeypatch.setattr("plane.app.services.llm.get_llm_config", lambda: {"provider": "gemini", "model": "gemini-test", "api_key": "secret", "base_url": "", "timeout": 60})
    monkeypatch.setattr("plane.app.services.llm.requests.post", lambda url, **kwargs: seen.update(url=url, kwargs=kwargs) or FakeResponse({"candidates": [{"content": {"parts": [{"text": "ok"}]}}], "usageMetadata": {"promptTokenCount": 2, "candidatesTokenCount": 1}}))
    response = generate(LLMRequest(system="system", messages=[{"role": "user", "content": "hello"}]))
    assert ":generateContent" in seen["url"]
    assert response.provider == "gemini"
```

Use `unittest.mock`/small fake responses at the HTTP boundary; add no mocking dependency.

- [ ] **Step 2: Run the tests and verify current protocol failure**

Run from `apps/api`: `pytest plane/tests/unit/services/test_llm.py -q`

Expected: FAIL because the shared service does not exist and current Anthropic/Gemini paths use the OpenAI client protocol.

- [ ] **Step 3: Implement immutable request/response and normalized errors**

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
    input_tokens: int | None = None
    output_tokens: int | None = None


class LLMError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
```

Map missing configuration, authentication, rate limit, timeout, outage, malformed response, unsupported provider, and context overflow to the stable spec codes. Logs contain request ID, provider, model, duration, status, and token counts only.

- [ ] **Step 4: Implement three protocol adapters with existing dependencies**

```python
def get_llm_provider(config):
    if config["provider"] in {"openai", "openai_compatible"}:
        return OpenAICompatibleProvider(config)
    if config["provider"] == "anthropic":
        return AnthropicProvider(config)
    if config["provider"] == "gemini":
        return GeminiProvider(config)
    raise LLMError("llm_provider_unavailable", "Configured LLM provider is unsupported.")


def generate(request: LLMRequest) -> LLMResponse:
    config = get_llm_config()
    return get_llm_provider(config).generate(request)
```

OpenAI-compatible uses `OpenAI(api_key=config["api_key"], base_url=config["base_url"] or None, timeout=config["timeout"])`. Anthropic uses native `/v1/messages`; Gemini uses native `models/{model}:generateContent`. Never include the key in an error message.

- [ ] **Step 5: Rewire existing Plane AI calls and configuration**

Replace provider classes and static model lists in `external/base.py` with calls into the shared service. Add encrypted/validated instance variables for base URL and timeout while retaining `GPT_ENGINE` only as deprecated fallback input.

- [ ] **Step 6: Run provider and existing AI tests**

Run from `apps/api`: `pytest plane/tests/unit/services/test_llm.py plane/tests/contract/app -k gpt -q`

Expected: OpenAI-compatible, Anthropic, Gemini, invalid-key, rate-limit, timeout, malformed response, missing config, and secret-redaction tests pass.

- [ ] **Step 7: Commit the provider boundary**

```bash
git add -- apps/api/plane/app/services apps/api/plane/app/views/external/base.py apps/api/plane/utils/instance_config_variables/core.py apps/api/plane/tests/unit/services
git commit -m "feat(ai): add instance-level multi-provider LLM boundary"
```

---

### Task 2: Instance-admin AI configuration and connection test

**Files:**

- Modify: `apps/api/plane/license/api/views/configuration.py`
- Modify: `apps/api/plane/license/api/views/__init__.py`
- Modify: `apps/api/plane/license/urls.py`
- Modify: `apps/api/plane/summon/views/operations.py`
- Modify: `apps/api/plane/summon/urls.py`
- Create: `apps/api/plane/tests/contract/license/__init__.py`
- Create: `apps/api/plane/tests/contract/license/test_llm_configuration.py`
- Modify: `apps/api/plane/tests/contract/summon/test_operations_api.py`
- Modify: `packages/types/src/instance/ai.ts`
- Modify: `packages/types/src/summon/index.ts`
- Modify: `packages/services/src/instance/instance.service.ts`
- Modify: `apps/web/core/services/summon.service.ts`
- Modify: `apps/admin/store/instance.store.ts`
- Modify: `apps/admin/app/(all)/(dashboard)/ai/form.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/settings/page.tsx`

**Interfaces:**

- Consumes: Task 1 `generate()`, `InstanceAdminPermission`, encrypted `InstanceConfiguration`, and existing admin configuration store.
- Produces: `POST /api/instances/configurations/test-llm/`, `GET /api/summon/workspaces/<slug>/settings/ai-status/`, typed provider fields, save/test controls, and safe status with no secret response.

- [ ] **Step 1: Write failing admin-only and redaction tests**

```python
@pytest.mark.django_db
def test_llm_connection_test_requires_instance_admin(api_client):
    response = api_client.post("/api/instances/configurations/test-llm/", {}, format="json")
    assert response.status_code in {401, 403}


@pytest.mark.django_db
def test_llm_connection_test_never_returns_secret(session_client, create_user, monkeypatch):
    instance = Instance.objects.create(instance_name="Test", instance_id="test-instance", current_version="1.0.0", last_checked_at=timezone.now())
    InstanceAdmin.objects.create(instance=instance, user=create_user, role=20)
    monkeypatch.setattr("plane.license.api.views.configuration.generate", lambda request: LLMResponse(text="ok", provider="openai", model="test"))
    response = session_client.post("/api/instances/configurations/test-llm/", {}, format="json")
    assert "api_key" not in str(response.data).lower()


@pytest.mark.django_db
def test_workspace_ai_status_returns_no_secret(session_client, workspace):
    response = session_client.get(f"/api/summon/workspaces/{workspace.slug}/settings/ai-status/")
    assert response.status_code == 200
    assert set(response.data) == {"configured", "provider", "model"}
```

- [ ] **Step 2: Run the test and verify route failure**

Run from `apps/api`: `pytest plane/tests/contract/license/test_llm_configuration.py -q`

Expected: FAIL because the connection-test endpoint is absent.

- [ ] **Step 3: Add a configuration-only health action**

```python
class LLMConnectionTestEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def post(self, request):
        try:
            response = generate(LLMRequest(system="Return a concise health response.", messages=[{"role": "user", "content": "health-check"}], temperature=0))
            return Response({"status": "ok", "provider": response.provider, "model": response.model})
        except LLMError as error:
            return Response({"status": "error", "code": error.code}, status=400)
```

Validate provider/model/base URL/timeout on configuration PATCH. Restrict `LLM_BASE_URL` to `http`/`https`, reject embedded credentials, and keep the value controlled by instance administrators only.

Add a workspace-Admin-only `LLMStatusView` that reads saved instance configuration and returns exactly `{configured, provider, model}`. It must never return the key, base URL, timeout, or upstream response. Connect Summon Settings to this read-only endpoint; all editing and connection testing remain in the instance-admin application.

- [ ] **Step 4: Expand admin types and form**

```ts
export type TInstanceAIConfigurationKeys =
  | "LLM_API_KEY"
  | "LLM_PROVIDER"
  | "LLM_MODEL"
  | "LLM_BASE_URL"
  | "LLM_REQUEST_TIMEOUT_SECONDS";

export interface ISummonAIStatus {
  configured: boolean;
  provider: "openai" | "openai_compatible" | "anthropic" | "gemini" | null;
  model: string | null;
}

getAIStatus(workspaceSlug: string) {
  return this.data<ISummonAIStatus>(this.get(`${this.root(workspaceSlug)}/settings/ai-status/`));
}
```

Render provider select, model input, conditional base URL, integer timeout, masked API-key input, Save, and Test connection. Remove OpenAI-only copy and links. Test connection uses only saved server configuration and displays the normalized status.

- [ ] **Step 5: Run API/admin checks and browser test**

Run from `apps/api`: `pytest plane/tests/contract/license/test_llm_configuration.py plane/tests/unit/services/test_llm.py -q`

Run from root: `pnpm --filter @plane/types check:types && pnpm --filter @plane/services check:types && pnpm --filter admin check:types && pnpm --filter admin check:format && pnpm --filter admin build`

Expected: PASS. In the admin browser, save one real provider configuration and obtain `status: ok`; screenshots and logs contain no API key.

- [ ] **Step 6: Commit instance administration**

```bash
git add -- apps/api/plane/license apps/api/plane/summon/views/operations.py apps/api/plane/summon/urls.py apps/api/plane/tests/contract/license apps/api/plane/tests/contract/summon/test_operations_api.py packages/types/src/instance/ai.ts packages/types/src/summon/index.ts packages/services/src/instance/instance.service.ts apps/web/core/services/summon.service.ts apps/admin/store/instance.store.ts 'apps/admin/app/(all)/(dashboard)/ai/form.tsx' 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/settings/page.tsx'
git commit -m "feat(admin): configure and test Summon LLM providers"
```

---

### Task 3: Authorized context builder and persistent Assistant API

**Files:**

- Create: `apps/api/plane/summon/models/assistant.py`
- Modify: `apps/api/plane/summon/models/__init__.py`
- Create: `apps/api/plane/summon/migrations/0002_assistant_conversation_message.py`
- Create: `apps/api/plane/summon/services/context.py`
- Modify: `apps/api/plane/summon/services/assistant.py`
- Modify: `apps/api/plane/summon/serializers/operations.py`
- Modify: `apps/api/plane/summon/views/operations.py`
- Modify: `apps/api/plane/summon/urls.py`
- Modify: `apps/api/plane/tests/contract/summon/test_schema.py`
- Create: `apps/api/plane/tests/contract/summon/test_assistant_api.py`
- Modify: `docs/architecture/summon-domain-ownership.md`

**Interfaces:**

- Consumes: Task 1 `generate()`, `visible_project_ids()`, authorized Plane/Summon records.
- Produces: `build_context(workspace, user, selection) -> ContextBundle`, `AssistantConversation`, `AssistantMessage`, conversation CRUD, message list, and explicit send action.

- [ ] **Step 1: Write failing model allowlist, isolation, and context-cap tests**

```python
def test_summon_model_allowlist_and_workspace_ownership():
    assert {model.__name__ for model in apps.get_app_config("summon").get_models()} == EXPECTED_MODELS | {"AssistantConversation", "AssistantMessage"}


@pytest.mark.django_db
def test_assistant_context_excludes_hidden_records_and_caps_source_text(session_client, workspace):
    text, truncated = cap_context(["A" * 20000, "B" * 20000])
    assert len(text) == 30000
    assert truncated is True
```

- [ ] **Step 2: Run tests and verify failure**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_schema.py plane/tests/contract/summon/test_assistant_api.py -q`

Expected: FAIL because the two models and routes do not exist.

- [ ] **Step 3: Add exactly the approved two models**

```python
class AssistantConversation(BaseModel):
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE)
    owner = models.ForeignKey("db.User", on_delete=models.CASCADE)
    project = models.ForeignKey("db.Project", null=True, blank=True, on_delete=models.SET_NULL)
    client = models.ForeignKey("summon.Client", null=True, blank=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=255)
    last_activity_at = models.DateTimeField()


class AssistantMessage(BaseModel):
    conversation = models.ForeignKey(AssistantConversation, on_delete=models.CASCADE, related_name="messages")
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE)
    role = models.CharField(max_length=12, choices=(("user", "User"), ("assistant", "Assistant")))
    content = models.TextField()
    citations = models.JSONField(default=list)
    provider = models.CharField(max_length=40, blank=True)
    model = models.CharField(max_length=120, blank=True)
    input_tokens = models.PositiveIntegerField(null=True, blank=True)
    output_tokens = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=16, default="completed")
```

Messages are append-only through the API. Conversation deletion follows repository soft-delete behavior. Querysets require both workspace and owner.

- [ ] **Step 4: Implement selected-context retrieval and send action**

```python
@dataclass(frozen=True)
class ContextBundle:
    text: str
    citations: list[dict[str, str]]
    truncated: bool


def cap_context(chunks, limit=30000):
    text = "\n\n".join(chunks)
    return text[:limit], len(text) > limit
```

Selection accepts explicit workspace/project/client/meeting/Page IDs only. Every ID passes the same direct-read permission filter. Save the user message, call the LLM, save the normalized assistant response/citations/metadata, and return both. On provider failure, persist a failed assistant message with the normalized code and no upstream body.

Retain the existing deterministic portfolio, overdue-work, pipeline, project-summary, Page-lookup, and automation-history answers as an explicit degraded path when the provider is unavailable. Persist `provider="deterministic"`, render a `Degraded mode` label, and never describe that output as an LLM response. Requests outside those truthful deterministic intents remain failed/retryable.

- [ ] **Step 5: Expose owner-scoped routes and run tests**

Routes: `/assistant/conversations/`, `/assistant/conversations/<id>/`, and `/assistant/conversations/<id>/messages/` where POST is the explicit send action.

Run from `apps/api`: `pytest plane/tests/contract/summon/test_schema.py plane/tests/contract/summon/test_assistant_api.py -q`

Expected: PASS for persistence, ownership, cross-workspace isolation, 30,000-character cap, citations, provider errors, and no implicit whole-workspace context.

- [ ] **Step 6: Commit Assistant persistence and context**

```bash
git add -- apps/api/plane/summon apps/api/plane/tests/contract/summon/test_schema.py apps/api/plane/tests/contract/summon/test_assistant_api.py docs/architecture/summon-domain-ownership.md
git commit -m "feat(summon): persist authorized assistant conversations"
```

---

### Task 4: Persistent Summon Assistant web experience

**Files:**

- Modify: `packages/types/src/summon/index.ts`
- Modify: `apps/web/core/services/summon.service.ts`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/page.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/assistant.test.ts`

**Interfaces:**

- Consumes: Task 3 conversation/message endpoints and normalized AI error codes.
- Produces: PDF page-7 persistent multi-turn assistant with explicit context, citations, reload, and confirm-before-write actions.

- [ ] **Step 1: Write failing persistence and secret guard**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Assistant uses persisted conversations and never sends credentials", () => {
  const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
  assert.match(source, /listAssistantConversations/);
  assert.match(source, /sendAssistantMessage/);
  assert.doesNotMatch(source, /apiKey|LLM_API_KEY|credential.*secret/i);
});
```

- [ ] **Step 2: Run the test and verify current one-shot failure**

Run: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/assistant.test.ts'`

Expected: FAIL because the page uses the old one-shot `queryAssistant()` flow.

- [ ] **Step 3: Add exact service methods and UI state**

```ts
export interface ISummonAssistantCitation {
  id: string;
  label: string;
  href: string;
  kind: "project" | "issue" | "page" | "client" | "meeting" | "resource";
}

export interface ISummonAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ISummonAssistantCitation[];
  provider: string;
  model: string;
  status: "completed" | "failed";
  created_at: string;
}

export interface ISummonAssistantConversation {
  id: string;
  title: string;
  project: string | null;
  client: string | null;
  last_activity_at: string;
  messages?: ISummonAssistantMessage[];
}

export interface ISummonAssistantMessageRequest {
  content: string;
  context: { workspace?: boolean; project_id?: string; client_id?: string; meeting_id?: string; page_ids?: string[] };
}

export interface ISummonAssistantMessagePair {
  user_message: ISummonAssistantMessage;
  assistant_message: ISummonAssistantMessage;
  context_truncated: boolean;
}

export type TSummonLLMErrorCode =
  | "llm_not_configured"
  | "llm_authentication_failed"
  | "llm_rate_limited"
  | "llm_timeout"
  | "llm_provider_unavailable"
  | "llm_invalid_response"
  | "llm_context_too_large";

listAssistantConversations(workspaceSlug: string) {
  return this.data<ISummonAssistantConversation[]>(this.get(`${this.root(workspaceSlug)}/assistant/conversations/`));
}

sendAssistantMessage(workspaceSlug: string, conversationId: string, payload: ISummonAssistantMessageRequest) {
  return this.data<ISummonAssistantMessagePair>(this.post(`${this.root(workspaceSlug)}/assistant/conversations/${conversationId}/messages/`, payload));
}
```

Add `createAssistantConversation()` and `getAssistantConversation()` beside these methods. Remove the obsolete `queryAssistant()` method after its final caller moves to the persistent API.

Render conversation history rail, message thread, explicit context selector, composer, pending/retry state, citations linking to canonical records, truncation disclosure, and action confirmation before navigating to/create flows. Never render instance credentials.

- [ ] **Step 4: Verify real multi-turn read-back**

Run: `node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/assistant.test.ts' && pnpm --filter @plane/types check:types && pnpm --filter web check:types && pnpm --filter web check:format`

Expected: PASS. Browser sends two messages against an explicitly selected project/Page, opens a citation, reloads, and sees both messages. Console contains zero errors.

- [ ] **Step 5: Commit Assistant UI**

```bash
git add -- packages/types/src/summon/index.ts apps/web/core/services/summon.service.ts 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant'
git commit -m "feat(summon): implement persistent LLM assistant UI"
```

---

### Task 5: LLM Automation preview/publish and meeting summarization

**Files:**

- Modify: `apps/api/plane/summon/models/automation.py`
- Modify: `apps/api/plane/summon/models/collaboration.py`
- Create: `apps/api/plane/summon/migrations/0003_ai_job_and_meeting_metadata.py`
- Modify: `apps/api/plane/summon/services/automation.py`
- Create: `apps/api/plane/summon/services/meeting_summary.py`
- Modify: `apps/api/plane/summon/serializers/operations.py`
- Modify: `apps/api/plane/summon/views/operations.py`
- Modify: `apps/api/plane/summon/views/collaboration.py`
- Modify: `apps/api/plane/summon/urls.py`
- Modify: `apps/api/plane/tests/contract/summon/test_operations_api.py`
- Create: `apps/api/plane/tests/contract/summon/test_meeting_summary_api.py`
- Modify: `packages/types/src/summon/index.ts`
- Modify: `apps/web/core/services/summon.service.ts`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/automation/page.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/meetings/[meetingId]/page.tsx`

**Interfaces:**

- Consumes: Task 1 `generate()`, Task 3 `build_context()`, existing AutomationTemplate/Job/GeneratedArtifact and Meeting/summary Page links.
- Produces: generate-preview, idempotent publish, and explicit meeting-summary actions with normalized metadata/errors.

- [ ] **Step 1: Write failing preview/publish/idempotency tests**

```python
@pytest.mark.django_db
def test_automation_preview_creates_no_page_and_publish_is_idempotent(session_client, workspace):
    template = AutomationTemplate.objects.create(workspace=workspace, name="Proposal", type="proposal", content_template="Create a proposal", variables=[])
    preview = session_client.post(f"/api/summon/workspaces/{workspace.slug}/automation/jobs/", {"template": str(template.id), "input": {"title": "Proposal"}, "context": {}}, format="json")
    assert preview.status_code == 201
    assert preview.data["status"] == "completed"
    assert Page.objects.filter(name="Proposal").count() == 0
    publish_url = f"/api/summon/workspaces/{workspace.slug}/automation/jobs/{preview.data['id']}/publish/"
    first = session_client.post(publish_url, {}, format="json")
    second = session_client.post(publish_url, {}, format="json")
    assert first.data["artifacts"][0]["id"] == second.data["artifacts"][0]["id"]
    assert Page.objects.filter(name="Proposal").count() == 1
```

- [ ] **Step 2: Write failing meeting-summary tests and run both files**

```python
@pytest.mark.django_db
def test_meeting_summary_requires_a_supplied_transcript(session_client, workspace):
    meeting = Meeting.objects.create(workspace=workspace, title="Review", starts_at=timezone.now())
    response = session_client.post(f"/api/summon/workspaces/{workspace.slug}/meetings/{meeting.id}/summary/", {}, format="json")
    assert response.status_code == 400
    assert response.data["code"] == "transcript_required"
```

Run from `apps/api`: `pytest plane/tests/contract/summon/test_operations_api.py plane/tests/contract/summon/test_meeting_summary_api.py -q`

Expected: FAIL because preview/publish and summary routes do not exist.

- [ ] **Step 3: Split generation from persistence**

Add these fields to the existing models; do not add another job or meeting model:

```python
class AutomationJob(BaseModel):
    preview_markdown = models.TextField(blank=True)
    provider = models.CharField(max_length=40, blank=True)
    model = models.CharField(max_length=120, blank=True)
    input_tokens = models.PositiveIntegerField(null=True, blank=True)
    output_tokens = models.PositiveIntegerField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)


class Meeting(BaseModel):
    summary_error = models.CharField(max_length=80, blank=True)
    summary_provider = models.CharField(max_length=40, blank=True)
    summary_model = models.CharField(max_length=120, blank=True)
    summary_input_tokens = models.PositiveIntegerField(null=True, blank=True)
    summary_output_tokens = models.PositiveIntegerField(null=True, blank=True)
```

```python
def generate_preview(template, project, requested_by, input_data, context_selection):
    bundle = build_context(template.workspace, requested_by, context_selection)
    response = generate(LLMRequest(system=template.content_template, messages=[{"role": "user", "content": json.dumps({"input": input_data, "context": bundle.text})}]))
    return AutomationJob.objects.create(workspace=template.workspace, template=template, project=project, requested_by=requested_by, type=template.type, status="completed", input=input_data, preview_markdown=response.text, provider=response.provider, model=response.model, input_tokens=response.input_tokens, output_tokens=response.output_tokens)
```

`publish_job(job, actor)` creates exactly one Plane Page and GeneratedArtifact inside `transaction.atomic()`, returns the existing artifact on retry, and rejects failed/unowned jobs. Persist only sanitized failure code/message.

- [ ] **Step 4: Implement meeting summary through the same boundary**

Read only the accessible supplied transcript plus explicitly linked context, call the LLM, validate summary/decisions/action suggestions, and save the summary to the meeting's canonical Plane Page. Suggestions are displayed first; work items are created only after a separate user confirmation through native Plane create/link behavior.

```python
class MeetingSummaryView(WorkspaceContextMixin, BaseAPIView):
    def post(self, request, slug, meeting_id):
        meeting = get_object_or_404(Meeting, workspace=self.workspace, id=meeting_id)
        summary = summarize_meeting(meeting, request.user)
        return Response(MeetingSerializer(summary).data)
```

- [ ] **Step 5: Implement the two PDF AI workspaces**

Automation renders template/context/output selection, Generate preview, validated preview, Publish, persistent job history, provider/model/status, citations, and normalized retry. Meeting renders Generate summary only when a transcript exists; after generation it renders summary, decisions, and confirmable action suggestions.

```tsx
<Button disabled={!job?.preview_markdown || Boolean(job.artifacts.length)} onClick={() => void publishPreview()}>
  Publish to Plane Page
</Button>
```

- [ ] **Step 6: Run all AI workflow tests and browser read-back**

Run from `apps/api`: `pytest plane/tests/contract/summon/test_operations_api.py plane/tests/contract/summon/test_meeting_summary_api.py plane/tests/contract/summon/test_assistant_api.py -q`

Run from root: `pnpm --filter @plane/types check:types && pnpm --filter web check:types && pnpm --filter web check:format && pnpm --filter web build`

Expected: PASS. Browser generates a real Automation preview, publishes once, reloads and opens the Plane Page; meeting summary uses a supplied transcript, reloads and opens its summary Page. Console contains zero errors.

- [ ] **Step 7: Commit AI workflows**

```bash
git add -- apps/api/plane/summon apps/api/plane/tests/contract/summon packages/types/src/summon/index.ts apps/web/core/services/summon.service.ts 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/automation' 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/meetings/[meetingId]'
git commit -m "feat(summon): add LLM automation and meeting summaries"
```

---

### Task 6: Provider-switch and privacy acceptance

**Files:**

- Review: all files changed by Tasks 1 through 5.

**Interfaces:**

- Consumes: configured provider boundary and all three AI product flows.
- Produces: evidence that provider changes require no web/domain change and secrets/context remain bounded.

- [ ] **Step 1: Run the complete AI test matrix**

Run from `apps/api`: `pytest plane/tests/unit/services/test_llm.py plane/tests/contract/license/test_llm_configuration.py plane/tests/contract/summon/test_schema.py plane/tests/contract/summon/test_assistant_api.py plane/tests/contract/summon/test_operations_api.py plane/tests/contract/summon/test_meeting_summary_api.py -q`

Run from root: `pnpm --filter @plane/types check:types && pnpm --filter @plane/services check:types && pnpm --filter admin check:types && pnpm --filter web check:types && pnpm --filter admin build && pnpm --filter web build && git diff --check`

Expected: every command exits 0.

- [ ] **Step 2: Run one real provider smoke**

Through the instance-admin UI, test the currently configured real provider. Then use the same web Assistant message, Automation preview, and meeting-summary flows. Record provider/model/status only; do not record prompt/response bodies or secrets in logs/screenshots.

- [ ] **Step 3: Prove provider interchangeability**

Change the instance configuration to another available supported protocol and rerun the same Assistant request without changing frontend or Summon domain code. If a second real credential is unavailable, the adapter contract tests are accepted for the second protocol but release notes must state that the second live smoke remains unverified.

- [ ] **Step 4: Capture accepted AI screens**

Capture instance AI configuration with the key masked, Assistant, Automation Studio, and Meeting Workspace at desktop/mobile sizes under `output/playwright/summon-ai/`, each with zero-error console logs and read-back evidence.
