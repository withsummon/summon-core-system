# Assistant File Context and Document Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Summon Assistant retain up to five document/audio attachments per message and, after mandatory user confirmation, generate previewable and downloadable PDF/DOCX artifacts through Automation Studio.

**Architecture:** Store every upload as a secured Plane `FileAsset` linked by a thin `AssistantAttachment` record. Feed ready attachment excerpts into the existing permission-scoped context builder, and represent document generation as a `summon_document` `AssistantAction` that creates an existing `AutomationJob`, calls the existing preview renderer, and serializes existing `GeneratedArtifact` downloads.

**Tech Stack:** Django, Django REST Framework, Celery, PostgreSQL, existing Faster Whisper HTTP service, React Router, React, SWR, TypeScript, `@plane/ui`, native file input/drag-and-drop, pytest, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-25-assistant-file-document-generation-design.md`

## Global Constraints

- Accept PDF, DOCX, XLSX, PPTX, TXT, MD, CSV, MP3, and M4A only.
- Accept at most five newly attached files in one Assistant message.
- Keep document uploads at the existing 10 MB extraction limit and MP3/M4A at the existing 250 MB recording limit.
- Keep ready attachments as context for the whole owner-scoped conversation.
- Require a final confirmation containing template, target Plane Project, source files, and PDF + DOCX before generation.
- Require an active authorized Plane Project before generation because existing artifact rendering is project-scoped.
- Reuse `AutomationTemplate`, `AutomationJob`, `GeneratedArtifact`, `generate_preview`, and `render_job_files`; do not add another renderer or artifact store.
- Reuse the existing transcription HTTP service; do not add a speech-to-text dependency.
- Do not add a vector database, upload library, or frontend dependency.
- Preserve text-only Assistant, Plane MCP actions, direct Automation Studio, and Meeting transcription behavior.

## File Structure

- `apps/api/plane/summon/models/assistant.py`: persist `AssistantAttachment` and the optional Automation job link on a result message.
- `apps/api/plane/summon/services/assistant_attachment.py`: validate attachment ownership/type, extract document text, and produce authorized context entries.
- `apps/api/plane/summon/services/transcription.py`: shared FileAsset-to-transcript HTTP call used by Meeting and Assistant tasks.
- `apps/api/plane/summon/services/assistant_document.py`: recognize generation requests, prepare/select/execute the confirmation action, and reuse Automation services.
- `apps/api/plane/summon/services/context.py`: accept caller-supplied authorized context entries before automatic RAG entries.
- `apps/api/plane/summon/serializers/operations.py`, `views/operations.py`, `urls.py`: expose attachment lifecycle and document-action operations.
- `apps/api/plane/app/views/asset/v2.py`: allow the new asset type and enforce owner/conversation access on patch, delete, and download.
- `packages/types/src/summon/index.ts`, `packages/types/src/enums.ts`, `apps/web/core/services/summon.service.ts`: shared contracts and API calls.
- `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/`: upload UI, template/confirmation card, and artifact result card.

---

### Task 1: Persist Assistant attachments and generated-job links

**Files:**

- Modify: `apps/api/plane/summon/models/assistant.py`
- Modify: `apps/api/plane/summon/models/__init__.py`
- Create: `apps/api/plane/summon/migrations/0007_assistant_attachment_and_job.py`
- Modify: `apps/api/plane/tests/contract/summon/test_schema.py`

**Interfaces:**

- Produces: `AssistantAttachment.Status`, `AssistantAttachment.file_asset`, `AssistantAttachment.extracted_text`, and `AssistantMessage.automation_job`.
- Consumes: existing `AssistantConversation`, `AssistantMessage`, `FileAsset`, and `AutomationJob`.

- [ ] **Step 1: Write the failing schema tests**

Add `AssistantAttachment` to `EXPECTED_MODELS` and assert the relationships and uniqueness contract:

```python
AssistantAttachment = apps.get_model("summon", "AssistantAttachment")
AssistantMessage = apps.get_model("summon", "AssistantMessage")

assert AssistantAttachment._meta.get_field("conversation").remote_field.model._meta.model_name == "assistantconversation"
assert AssistantAttachment._meta.get_field("file_asset").one_to_one is True
assert AssistantAttachment._meta.get_field("message").null is True
assert AssistantMessage._meta.get_field("automation_job").remote_field.model._meta.model_name == "automationjob"
```

- [ ] **Step 2: Run the schema tests and verify failure**

Run:

```bash
docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/contract/summon/test_schema.py -q
```

Expected: failure because `AssistantAttachment` and `automation_job` do not exist.

- [ ] **Step 3: Add the minimal models and migration**

Implement this model shape and export it from `models/__init__.py`:

```python
class AssistantAttachment(BaseModel):
    class Status(models.TextChoices):
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE)
    conversation = models.ForeignKey(AssistantConversation, on_delete=models.CASCADE, related_name="attachments")
    message = models.ForeignKey(AssistantMessage, null=True, blank=True, on_delete=models.SET_NULL, related_name="attachments")
    file_asset = models.OneToOneField("db.FileAsset", on_delete=models.CASCADE, related_name="summon_assistant_attachment")
    original_name = models.CharField(max_length=255)
    media_type = models.CharField(max_length=120)
    size = models.PositiveBigIntegerField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PROCESSING)
    extracted_text = models.TextField(blank=True)
    language = models.CharField(max_length=20, blank=True)
    error = models.CharField(max_length=80, blank=True)
```

Add to `AssistantMessage`:

```python
automation_job = models.ForeignKey(
    "summon.AutomationJob",
    null=True,
    blank=True,
    on_delete=models.SET_NULL,
    related_name="assistant_messages",
)
```

Generate migration `0007_assistant_attachment_and_job.py` with only these schema changes.

- [ ] **Step 4: Run schema tests and migration check**

Run:

```bash
docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/contract/summon/test_schema.py -q
docker compose -f docker-compose-test.yml run --rm api-tests python manage.py makemigrations --check --dry-run
```

Expected: tests pass and Django reports no pending model changes.

- [ ] **Step 5: Commit the schema**

```bash
git add apps/api/plane/summon/models/assistant.py apps/api/plane/summon/models/__init__.py apps/api/plane/summon/migrations/0007_assistant_attachment_and_job.py apps/api/plane/tests/contract/summon/test_schema.py
git commit -m "feat: persist assistant file context"
```

### Task 2: Secure the Assistant FileAsset upload type

**Files:**

- Modify: `apps/api/plane/db/models/asset.py`
- Modify: `apps/api/plane/app/views/asset/v2.py`
- Modify: `packages/types/src/enums.ts`
- Modify: `apps/api/plane/tests/contract/summon/test_assistant_api.py`

**Interfaces:**

- Produces: `FileAsset.EntityTypeContext.ASSISTANT_ATTACHMENT` and `EFileAssetType.ASSISTANT_ATTACHMENT`.
- Consumes: `AssistantAttachment.file_asset` from Task 1.

- [ ] **Step 1: Write failing upload and authorization tests**

Create tests that post metadata to `/api/assets/v2/workspaces/{slug}/` and prove:

```python
payload = {
    "name": "brief.pdf",
    "type": "application/pdf",
    "size": 1024,
    "entity_type": "ASSISTANT_ATTACHMENT",
    "entity_identifier": str(conversation.id),
}
assert session_client.post(url, payload, format="json").status_code == 200
assert session_client.post(url, {**payload, "name": "script.html", "type": "text/html"}, format="json").status_code == 400
```

Also create an uploaded Assistant asset linked to `AssistantAttachment`; assert its owner can patch/delete/download and another active workspace member receives 404. Assert an unlinked Assistant asset cannot be downloaded.

- [ ] **Step 2: Run the focused tests and verify failure**

```bash
docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/contract/summon/test_assistant_api.py -k "assistant_asset" -q
```

Expected: failure because the asset entity type is rejected and owner authorization is absent.

- [ ] **Step 3: Implement the asset type with existing limits**

Add `ASSISTANT_ATTACHMENT` to both enums. In `WorkspaceFileAssetEndpoint.post`, select the allowed MIME types and limit by extension/media class:

```python
ASSISTANT_DOCUMENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/markdown",
    "text/csv",
}
ASSISTANT_AUDIO_TYPES = {"audio/mpeg", "audio/mp4", "audio/x-m4a"}
```

Use `10 * 1024 * 1024` for Assistant documents and `settings.SUMMON_RECORDING_FILE_SIZE_LIMIT` for Assistant audio. Store `user=request.user` for this entity type and keep `entity_identifier=conversation.id`.

Add a single helper used by patch/delete/get:

```python
def authorize_assistant_attachment_asset(asset, actor):
    if asset.entity_type != FileAsset.EntityTypeContext.ASSISTANT_ATTACHMENT:
        return
    if not AssistantAttachment.objects.filter(
        file_asset=asset,
        conversation__owner=actor,
        workspace_id=asset.workspace_id,
        deleted_at__isnull=True,
    ).exists():
        raise Http404
```

During the upload-finalization patch, allow the creator to finalize the still-unlinked asset when `asset.user_id == request.user.id`; require the linked record for delete/get. Return the normal workspace asset URL from `FileAsset.asset_url` for this type.

- [ ] **Step 4: Run Assistant asset and Meeting recording regressions**

```bash
docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/contract/summon/test_assistant_api.py -k "assistant_asset" -q
docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/contract/summon/test_meeting_transcription.py -q
```

Expected: all selected tests pass; existing Meeting upload behavior is unchanged.

- [ ] **Step 5: Commit secure uploads**

```bash
git add apps/api/plane/db/models/asset.py apps/api/plane/app/views/asset/v2.py packages/types/src/enums.ts apps/api/plane/tests/contract/summon/test_assistant_api.py
git commit -m "feat: secure assistant attachment uploads"
```

### Task 3: Process documents and audio into persistent attachment context

**Files:**

- Create: `apps/api/plane/summon/services/transcription.py`
- Create: `apps/api/plane/summon/services/assistant_attachment.py`
- Modify: `apps/api/plane/summon/tasks.py`
- Modify: `apps/api/plane/summon/serializers/operations.py`
- Modify: `apps/api/plane/summon/serializers/__init__.py`
- Modify: `apps/api/plane/summon/views/operations.py`
- Modify: `apps/api/plane/summon/views/__init__.py`
- Modify: `apps/api/plane/summon/urls.py`
- Modify: `apps/api/plane/tests/contract/summon/test_assistant_api.py`
- Modify: `apps/api/plane/tests/contract/summon/test_meeting_transcription.py`

**Interfaces:**

- Produces: `create_attachment(conversation, actor, asset) -> AssistantAttachment`, `attachment_context_entries(conversation, actor, attachment_ids=None) -> list[tuple[str, dict]]`, and `transcribe_file_asset(asset) -> tuple[str, str]`.
- Consumes: Task 1 model and Task 2 asset type.

- [ ] **Step 1: Write failing attachment API tests**

Cover document extraction, audio queueing, owner scope, deletion before message binding, and serialization:

```python
response = session_client.post(attachments_url, {"asset_id": str(asset.id)}, format="json")
assert response.status_code == 201
assert response.data["status"] == "ready"
assert response.data["original_name"] == "brief.pdf"
assert "Verified scope" in AssistantAttachment.objects.get(id=response.data["id"]).extracted_text
```

For audio, patch `transcribe_assistant_attachment.delay`, assert status `processing` and one queued call. Assert another user receives 404 for list/create/delete. Assert creating a sixth simultaneously unbound attachment is rejected with `maximum_five_attachments`; attachments already bound to earlier messages do not count against the next message.

- [ ] **Step 2: Write failing shared-transcription regression**

Move the HTTP expectation into a unit around:

```python
text, language = transcribe_file_asset(asset)
assert text == "[00:00:00] Keputusan disetujui."
assert language == "id"
```

Keep the existing Meeting task test proving the transcript still reaches the Meeting Page.

- [ ] **Step 3: Run the focused tests and verify failure**

```bash
docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/contract/summon/test_assistant_api.py -k "attachment" -q
docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/contract/summon/test_meeting_transcription.py -q
```

Expected: failures because attachment endpoints and shared transcription do not exist.

- [ ] **Step 4: Extract the shared transcription call**

Move only asset opening, the Faster Whisper HTTP request, response validation, and sanitized exception mapping into:

```python
def transcribe_file_asset(asset):
    """Return (text, language) or raise TranscriptionError."""
```

Keep `transcribe_meeting_recording` responsible for Meeting/project authorization and `write_meeting_transcript`. Add `transcribe_assistant_attachment(attachment_id, actor_id)` responsible for conversation ownership, status updates, and saving `extracted_text`, `language`, or `error="transcription_failed"`.

- [ ] **Step 5: Implement attachment validation and extraction**

`create_attachment` must verify workspace, owner, `asset.user_id`, `entity_identifier`, uploaded/not-deleted state, extension, MIME type, and size. For documents, open the FieldFile and call existing `extract_context_document`; for audio, create `processing` and queue the Celery task after commit.

Serialize only safe metadata:

```python
fields = ["id", "message", "original_name", "media_type", "size", "status", "language", "error", "created_at"]
```

Do not serialize storage paths or extracted text. Add:

```text
GET/POST /api/summon/workspaces/{slug}/assistant/conversations/{conversation_id}/attachments/
DELETE   /api/summon/workspaces/{slug}/assistant/conversations/{conversation_id}/attachments/{attachment_id}/
```

Deletion is permitted only while `message_id is None`; it soft-deletes the relation and FileAsset.

- [ ] **Step 6: Run processing and regression tests**

```bash
docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/contract/summon/test_assistant_api.py -k "attachment" -q
docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/contract/summon/test_meeting_transcription.py -q
```

Expected: all selected tests pass.

- [ ] **Step 7: Commit attachment processing**

```bash
git add apps/api/plane/summon/services/transcription.py apps/api/plane/summon/services/assistant_attachment.py apps/api/plane/summon/tasks.py apps/api/plane/summon/serializers/operations.py apps/api/plane/summon/serializers/__init__.py apps/api/plane/summon/views/operations.py apps/api/plane/summon/views/__init__.py apps/api/plane/summon/urls.py apps/api/plane/tests/contract/summon/test_assistant_api.py apps/api/plane/tests/contract/summon/test_meeting_transcription.py
git commit -m "feat: process assistant document and audio context"
```

### Task 4: Add ready attachments to conversation RAG and bind them to messages

**Files:**

- Modify: `apps/api/plane/summon/services/context.py`
- Modify: `apps/api/plane/summon/services/assistant.py`
- Modify: `apps/api/plane/summon/serializers/operations.py`
- Modify: `apps/api/plane/summon/views/operations.py`
- Modify: `apps/api/plane/tests/contract/summon/test_assistant_api.py`

**Interfaces:**

- Produces: `build_context(..., source_entries=())` and `AssistantMessageRequestSerializer.attachment_ids`.
- Consumes: `attachment_context_entries` from Task 3.

- [ ] **Step 1: Write failing RAG and binding tests**

Create two ready attachments and one processing attachment. Send one message with the two ready IDs and assert:

```python
assert set(user_message.attachments.values_list("id", flat=True)) == {ready_a.id, ready_b.id}
prompt = repr(captured_request)
assert "[Attached File: brief.pdf]" in prompt
assert "[Attached File: notes.docx]" in prompt
assert "still-processing.mp3" not in prompt
```

Send a later message with `attachment_ids=[]` and assert both ready file contents still appear. Assert foreign, failed, processing, and more-than-five IDs are rejected. Assert the serialized user message contains the bound attachment metadata.

- [ ] **Step 2: Run the focused tests and verify failure**

```bash
docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/contract/summon/test_assistant_api.py -k "attachment_context or attachment_binding" -q
```

Expected: failure because attachment IDs and source entries are not consumed.

- [ ] **Step 3: Extend the existing context builder without a second RAG engine**

Change the signature to:

```python
def build_context(workspace, user, selection, query="", source_entries=()):
    entries = list(source_entries)
    # existing explicit and automatic entries follow
```

`attachment_context_entries` returns only ready, non-deleted records owned through the conversation, ordered by creation time, with source text and an `attachment` citation pointing to the authorized asset URL. The existing `_cap_context_entries` remains the single 30,000-character cap.

- [ ] **Step 4: Bind new attachments and retain conversation context**

Add `attachment_ids = serializers.ListField(child=serializers.UUIDField(), max_length=5, required=False, default=list)` to the request serializer. In `send_message`, validate the submitted unbound IDs, create the user message, assign those attachments to it, then build context from every ready attachment in the conversation. Keep the current history, deterministic fallback, and provider-error behavior unchanged.

- [ ] **Step 5: Run Assistant API regression tests**

```bash
docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/contract/summon/test_assistant_api.py -q
```

Expected: all Assistant API tests pass.

- [ ] **Step 6: Commit persistent attachment RAG**

```bash
git add apps/api/plane/summon/services/context.py apps/api/plane/summon/services/assistant.py apps/api/plane/summon/serializers/operations.py apps/api/plane/summon/views/operations.py apps/api/plane/tests/contract/summon/test_assistant_api.py
git commit -m "feat: include conversation files in assistant RAG"
```

### Task 5: Confirm and execute document generation through Automation Studio

**Files:**

- Create: `apps/api/plane/summon/services/assistant_document.py`
- Modify: `apps/api/plane/summon/services/assistant_action.py`
- Modify: `apps/api/plane/summon/services/automation.py`
- Modify: `apps/api/plane/summon/serializers/operations.py`
- Modify: `apps/api/plane/summon/views/operations.py`
- Modify: `apps/api/plane/summon/urls.py`
- Modify: `apps/api/plane/tests/contract/summon/test_assistant_api.py`
- Modify: `apps/api/plane/tests/contract/summon/test_generated_document_api.py`

**Interfaces:**

- Produces: `DOCUMENT_TOOL = "summon_document"`, `handle_document_message(...)`, `select_document_template(action, template_id)`, and `execute_document_action(action) -> AutomationJob`.
- Consumes: Task 3 attachment entries, Task 4 context extension, existing Automation services, and existing action confirm/cancel endpoint.

- [ ] **Step 1: Write failing document-request tests**

Cover these states:

```python
ambiguous = post_message("Buatkan dokumen dari file ini")
assert ambiguous.data["action"]["tool"] == "summon_document"
assert ambiguous.data["action"]["preview"]["state"] == "choose_template"

explicit = post_message("Buat MoM dari rekaman ini", project_id=project.id)
assert explicit.data["action"]["preview"]["state"] == "confirm"
assert explicit.data["action"]["preview"]["formats"] == ["pdf", "docx"]
```

Assert ordinary questions such as `Apa manfaat dokumen ini?` still call `send_message` and do not create an action. Assert a typed reply matching an enabled template updates the latest `choose_template` action instead of starting a second action.

- [ ] **Step 2: Write failing confirmation/idempotency tests**

Patch `generate_preview` and `render_job_files`, confirm the action twice, and assert one job is returned both times. Assert missing project, inaccessible template, foreign attachment, and processing audio fail before either Automation function is called. Assert cancel never generates. Assert retry is available only for failed `summon_document` actions.

- [ ] **Step 3: Run focused tests and verify failure**

```bash
docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/contract/summon/test_assistant_api.py -k "document_action" -q
```

Expected: failure because document actions are not recognized or executable.

- [ ] **Step 4: Implement minimal natural-language routing and template selection**

Recognize a request only when it contains a generation verb and a document indicator, or directly matches an enabled template name/type. Normalize case, whitespace, hyphens, and underscores; use enabled `AutomationTemplate` rows as the source of choices. Do not use a second LLM call.

Create one pending action with this stable preview contract:

```python
{
    "state": "choose_template" or "confirm",
    "title": "Generate document",
    "summary": content,
    "template": {"id": str(template.id), "name": template.name, "type": template.type} or None,
    "template_options": [{"id": str(item.id), "name": item.name, "type": item.type}],
    "project": {"id": str(project.id), "name": project.name} or None,
    "sources": [{"id": str(item.id), "name": item.original_name, "status": item.status}],
    "formats": ["pdf", "docx"],
}
```

Add `POST .../actions/{action_id}/select/` with `{ "template_id": "..." }`. A typed template answer runs the same selector. The final confirmation remains pending; selection never generates.

- [ ] **Step 5: Execute only through existing Automation services**

On confirm, lock and revalidate the action, requester, active template, active Project membership, and ready source attachments. Then:

```python
job = generate_preview(
    template,
    project,
    action.requester,
    {"title": title, "instructions": action.arguments["request"], "source_files": source_names},
    action.arguments["context"],
    source_entries=attachment_context_entries(
        action.conversation,
        action.requester,
        attachment_ids=action.arguments["attachment_ids"],
    ),
)
if job.status == AutomationJob.Status.COMPLETED:
    render_job_files(job, action.requester)
```

Extend `generate_preview(..., source_entries=())` only to pass those entries to `build_context`; existing callers remain unchanged. Create one Assistant result message linked by `automation_job=job`. Put only `automation_job_id` in `action.result`.

Serialize `automation_job` on `AssistantMessage` using the existing `AutomationJobSerializer`, including artifact `file_detail.href` links. Add `POST .../actions/{action_id}/retry/`; it reuses the same action/job state and refuses while a job is running.

- [ ] **Step 6: Run Assistant and generated-document tests**

```bash
docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/contract/summon/test_assistant_api.py -q
docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/contract/summon/test_generated_document_api.py -q
```

Expected: both files pass, including existing direct Automation render/download tests.

- [ ] **Step 7: Commit document action orchestration**

```bash
git add apps/api/plane/summon/services/assistant_document.py apps/api/plane/summon/services/assistant_action.py apps/api/plane/summon/services/automation.py apps/api/plane/summon/serializers/operations.py apps/api/plane/summon/views/operations.py apps/api/plane/summon/urls.py apps/api/plane/tests/contract/summon/test_assistant_api.py apps/api/plane/tests/contract/summon/test_generated_document_api.py
git commit -m "feat: generate automation documents from assistant"
```

### Task 6: Add shared TypeScript contracts and service calls

**Files:**

- Modify: `packages/types/src/summon/index.ts`
- Modify: `apps/web/core/services/summon.service.ts`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/assistant.test.ts`

**Interfaces:**

- Produces: `ISummonAssistantAttachment`, typed document action preview, `createAssistantAttachment`, `deleteAssistantAttachment`, `selectAssistantDocumentTemplate`, and `retryAssistantAction`.
- Consumes: backend response contracts from Tasks 3-5 and `EFileAssetType.ASSISTANT_ATTACHMENT` from Task 2.

- [ ] **Step 1: Write failing contract tests**

Extend `assistant.test.ts` to require service methods and type markers:

```ts
for (const method of [
  "createAssistantAttachment",
  "deleteAssistantAttachment",
  "selectAssistantDocumentTemplate",
  "retryAssistantAction",
]) {
  assert.match(service, new RegExp(method));
}
assert.match(types, /ISummonAssistantAttachment/);
assert.match(types, /automation_job/);
assert.match(types, /attachment_ids/);
```

- [ ] **Step 2: Run the Node test and verify failure**

```bash
node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/assistant.test.ts'
```

Expected: failure because the contracts and calls are absent.

- [ ] **Step 3: Add exact shared types**

Define attachment status and safe metadata, add `attachments` and `automation_job` to messages, add `attachments` to conversations, and add `attachment_ids?: string[]` to the request. Type the document preview fields instead of casting them in UI code.

- [ ] **Step 4: Add service calls**

Use the Assistant routes from Tasks 3 and 5. Keep binary upload on the existing `FileService.uploadWorkspaceAsset`; `createAssistantAttachment` only posts the completed `asset_id` to the Summon API.

- [ ] **Step 5: Run tests and types package check**

```bash
node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/assistant.test.ts'
pnpm turbo run check:types --filter=@plane/types
```

Expected: test and type check pass.

- [ ] **Step 6: Commit contracts**

```bash
git add packages/types/src/summon/index.ts apps/web/core/services/summon.service.ts 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/assistant.test.ts'
git commit -m "feat: type assistant file generation contracts"
```

### Task 7: Build the Assistant upload, confirmation, and result UI

**Files:**

- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/page.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/assistant-composer.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/message-list.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/assistant-action-card.tsx`
- Create: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/assistant-artifact-card.tsx`
- Modify: `apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/assistant.test.ts`

**Interfaces:**

- Produces: accessible upload chips, template choices, mandatory Generate/Cancel, Retry, Preview, Download PDF, and Download DOCX.
- Consumes: Task 6 contracts/services, existing `FileService`, existing `automationJobPath`, and existing artifact download hrefs.

- [ ] **Step 1: Write failing UI source-contract tests**

Require the actual controls and limits:

```ts
for (const marker of [
  "ASSISTANT_ATTACHMENT",
  "multiple",
  "MAX_ATTACHMENTS",
  "Generate",
  "Cancel",
  "Preview",
  "Download PDF",
  "Download DOCX",
  "Retry",
])
  assert.match(implementation, new RegExp(marker));
```

Also assert the composer contains `aria-label="Attach files"`, an `accept` list, status text, and a removal button; assert the page passes `attachment_ids` when sending.

- [ ] **Step 2: Run Assistant UI tests and verify failure**

```bash
node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/assistant.test.ts' 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/composer-keyboard.test.ts'
```

Expected: Assistant test fails on missing upload/generation UI; keyboard test remains passing.

- [ ] **Step 3: Add native upload and drag/drop**

Keep `pendingAttachments` in `page.tsx`. Ensure a conversation exists before upload, then for each accepted file:

```ts
const asset = await fileService.uploadWorkspaceAsset(
  workspaceSlug,
  { entity_identifier: conversationId, entity_type: EFileAssetType.ASSISTANT_ATTACHMENT },
  file,
  progressHandler
);
await summonService.createAssistantAttachment(workspaceSlug, conversationId, asset.asset_id);
```

Reject more than five new files, unsupported extensions, documents over 10 MB, and audio over 250 MB before network calls. Use a hidden native `<input type="file" multiple>` plus a keyboard-accessible button and drag/drop handlers; do not add a dependency. On remove, call the attachment delete endpoint only for unbound attachments. Include ready IDs in the next `sendAssistantMessage`, clear only successfully bound local chips, and reload the conversation.

- [ ] **Step 4: Render persisted attachment states**

Show `Uploading`, `Ready`, `Transcribing`, or `Failed` chips in the composer and bound file chips below their originating user message. Poll the conversation every three seconds only while at least one attachment is `processing`; stop polling otherwise.

- [ ] **Step 5: Specialize the existing action card**

For `tool !== "summon_document"`, preserve the current Plane MCP card exactly. For document actions:

- `choose_template`: render buttons from `template_options` and retain typed-answer support through the message composer;
- `confirm`: show template, target project, source filenames, PDF + DOCX, Generate, and Cancel;
- disable Generate when project/template is missing or a source is not ready;
- `failed`: show the safe error and Retry.

- [ ] **Step 6: Add result artifact card**

For messages with `automation_job`, show current status and use:

```tsx
<Link href={automationJobPath(workspaceSlug, job.id)}>Preview</Link>
<a href={pdf.file_detail.href}>Download PDF</a>
<a href={docx.file_detail.href}>Download DOCX</a>
```

Render only artifacts actually returned by the API. Do not synthesize URLs.

- [ ] **Step 7: Run UI tests, formatting, and web type check**

```bash
node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/assistant.test.ts' 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/composer-keyboard.test.ts' 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/automation/automation.test.ts'
pnpm exec oxfmt --check 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant' packages/types/src/summon/index.ts apps/web/core/services/summon.service.ts
pnpm turbo run check:types --filter=web
```

Expected: all tests, formatting, and type checking pass.

- [ ] **Step 8: Commit the UI**

```bash
git add 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant' packages/types/src/summon/index.ts apps/web/core/services/summon.service.ts
git commit -m "feat: add assistant file generation UI"
```

### Task 8: Run full scoped verification and authenticated browser UAT

**Files:**

- Modify only if a verification failure exposes a defect in files already listed above.

**Interfaces:**

- Consumes: the complete feature from Tasks 1-7.
- Produces: test output and browser evidence for the exact user flow.

- [ ] **Step 1: Run backend feature and regression suites**

```bash
docker compose -f docker-compose-test.yml run --rm api-tests pytest plane/tests/contract/summon/test_schema.py plane/tests/contract/summon/test_assistant_api.py plane/tests/contract/summon/test_generated_document_api.py plane/tests/contract/summon/test_meeting_transcription.py -q
```

Expected: all selected backend tests pass.

- [ ] **Step 2: Run frontend feature and regression checks**

```bash
node --test 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/assistant.test.ts' 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/assistant/composer-keyboard.test.ts' 'apps/web/app/(all)/[workspaceSlug]/(projects)/summon/automation/automation.test.ts'
pnpm turbo run check:types --filter=@plane/types --filter=web
pnpm turbo run check:lint --filter=web
git diff --check
```

Expected: every command exits zero.

- [ ] **Step 3: Exercise the authenticated browser flow**

On `/{workspaceSlug}/summon/assistant/`:

1. Upload five supported documents and verify a sixth is rejected before upload.
2. Upload one MP3 and one M4A in separate messages; observe transcribing then ready.
3. Ask a follow-up question without new files and verify the response cites an earlier attachment.
4. Request an unspecified document and verify template buttons plus typed selection.
5. Select an authorized Project context and verify the final card lists project, sources, and PDF + DOCX.
6. Click Generate once; verify one job and a persistent generating/result state after refresh.
7. Open Preview on the dedicated Automation detail route.
8. Download and open the returned PDF and DOCX; verify their content is grounded in the uploaded sources.
9. Check browser console and network failures throughout.
10. Use another workspace member and verify attachment URL, conversation, preview, and artifact return 404/403 as designed.

- [ ] **Step 4: Inspect final scope and commit any verification-only fix**

```bash
git status --short
git diff --check
git diff --stat
```

Keep `output/` and unrelated user-owned changes unstaged. If verification required a scoped fix, stage only its named files and commit with `fix: verify assistant file generation`; otherwise create no empty commit.
