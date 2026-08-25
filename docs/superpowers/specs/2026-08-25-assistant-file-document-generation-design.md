# Assistant File Context and Document Generation Design

## Problem

Summon Assistant currently accepts text only. Users cannot attach source documents or recordings, keep those files as conversation context, or request a generated document without leaving the Assistant page.

Automation Studio already owns document templates, preview generation, PDF/DOCX rendering, artifact persistence, authorization, and downloads. The Assistant must reuse that flow rather than introduce a second generator.

## Outcome

When this work ships:

- a user can attach up to five supported files to one Assistant message;
- attachments remain available as authorized context throughout the conversation;
- documents and MP3/M4A recordings can supply source context;
- every generation request requires an explicit confirmation showing its template, source files, and PDF/DOCX outputs;
- the confirmed request creates the same `AutomationJob` and `GeneratedArtifact` records used by Automation Studio;
- the resulting Assistant message provides Preview, Download PDF, and Download DOCX actions;
- upload, conversation, preview, and download access remains workspace- and user-scoped.

## Scope

Supported input types are PDF, DOCX, XLSX, PPTX, TXT, MD, CSV, MP3, and M4A. A message can contain zero through five files. Unsupported files and a sixth file are rejected before submission with a clear per-file error.

Generated output is always PDF and DOCX in the first release. Users can request any enabled Automation template, including MoM. Template management, new output formats, conversation sharing, and a new vector database are outside this scope.

## Reused Ownership Boundaries

Plane `FileAsset` remains the canonical stored-file record. Automation Studio remains the canonical owner of:

- templates and their requirements;
- `AutomationJob` lifecycle;
- preview generation;
- PDF and DOCX rendering;
- `GeneratedArtifact` metadata;
- authorized preview and download behavior.

Assistant owns only the conversation attachment relationship, the pending confirmation action, and the link from a result message to the Automation job. It does not copy templates, previews, artifacts, or rendering code.

## Persistence

Add one thin Assistant attachment record that links an `AssistantConversation` to a `FileAsset` and records the originating message, original name, media type, size, processing status, and any reference needed to retrieve extracted text or a completed transcript.

Attachments remain conversation context after refresh and across later messages. They follow the conversation's workspace and owner authorization. Conversation deletion follows the repository's existing deletion behavior; generated artifacts continue to follow Automation retention rules.

Reuse `AssistantAction` for a pending document-generation confirmation. Its arguments contain the selected template, source attachment identifiers, requested title or instructions, and fixed output formats. Confirmation is idempotent: one action can create at most one Automation job.

Link the Assistant result message to the resulting `AutomationJob`. Artifact data is serialized from that job rather than copied into message JSON.

## User Flow

1. The user selects or drags up to five files into the composer.
2. Each attachment displays `Uploading`, `Ready`, `Transcribing`, or `Failed`.
3. Documents use the existing extraction path. MP3/M4A files use the existing Meeting/Faster Whisper transcription path and cannot be selected for generation until transcription finishes.
4. Ready files appear as attachment chips and become conversation context.
5. The user can ask questions about attached files or request a generated document.
6. If the requested document type is unclear, Assistant presents enabled template choices as buttons while continuing to accept a natural-language answer.
7. Assistant always presents a final confirmation card containing the document type/template, selected source files, PDF + DOCX outputs, and `Generate` and `Cancel` actions.
8. `Generate` disables repeated submission and changes the card status to `Generating`.
9. The backend creates an `AutomationJob`, generates its preview, and renders PDF and DOCX through the existing Automation services.
10. On success, the Assistant result card exposes `Preview`, `Download PDF`, and `Download DOCX`. Preview opens the existing dedicated Automation detail page; downloads use the existing authorized artifact endpoints.
11. On failure, the card shows a safe summary and `Retry`. Retry reuses the same confirmed action unless no job exists; it never starts a second job while one is running.

## Assistant Context and RAG

The existing permission-scoped Automatic RAG remains the retrieval engine. Ready attachment text and completed transcripts are added as conversation-scoped sources; no second RAG service or vector database is introduced.

Attachment context is size-bounded before entering a model request. The service selects relevant excerpts and retains the source filename so Assistant responses can identify their evidence. A file that is still processing or failed extraction is excluded and visibly marked rather than silently treated as empty context.

## API and Serialization

Extend the Assistant API with the smallest additions needed to:

- upload and list conversation attachments;
- return attachment processing state with conversation messages;
- create and serialize a pending document-generation action;
- confirm, cancel, or retry that action;
- return the linked Automation job and its preview/artifact details in the result message.

The existing Automation generation, render, detail, and download services remain the only document-output implementation. The frontend consumes their existing secure artifact links.

## Authorization and Validation

- Every attachment upload requires active workspace membership and conversation ownership.
- Every attachment read verifies access to both the conversation and underlying `FileAsset`.
- Only ready attachments from the same conversation can be included in a generation action.
- Confirmation revalidates template availability, attachment access, and Automation permissions instead of trusting serialized action arguments.
- Preview and downloads retain existing Automation job/artifact authorization.
- Invalid media type, file count, file size, extraction, transcription, AI, and renderer errors return safe messages without exposing storage paths, prompts, credentials, or provider responses.

## Failure Behavior

File validation and processing failures are isolated per attachment; one failed file does not remove successful files or discard the user's message. Audio remains visibly unavailable until transcription completes.

A generation failure preserves the Automation job, preview, and any successfully persisted artifact so a retry can resume through the existing service behavior. The UI prevents duplicate clicks while an action or job is pending. Refreshing the page reconstructs attachment, confirmation, job, and artifact states from persisted records.

## Frontend Changes

The Assistant composer gains a native multi-file input and drag-and-drop target with an accessible trigger, file chips, removal controls, and per-file state. No new upload dependency is added.

The message list gains two focused cards:

- a confirmation card for template/source/output review and Generate/Cancel;
- a result card for generation status, Preview, Download PDF, Download DOCX, and Retry.

Existing text-only conversations and context controls retain their current behavior.

## Verification

Automated coverage must include:

- maximum-five and supported-type validation;
- workspace, conversation, file, action, job, and artifact authorization;
- persistent conversation attachment serialization;
- exclusion of failed or processing attachments from model context;
- mandatory confirmation and one-job-per-action idempotency;
- existing Automation service reuse and artifact serialization;
- frontend upload, status, template selection, confirmation, cancel, retry, and result-card states;
- regression coverage for text-only Assistant and direct Automation Studio flows.

Run relevant backend tests, frontend tests, type checking, linting, and `git diff --check`.

Authenticated browser verification must prove:

1. five documents upload and a sixth is rejected clearly;
2. MP3 and M4A progress through transcription to ready context;
3. attached sources remain usable after later messages and a page refresh;
4. ambiguous generation requests offer template buttons and accept typed answers;
5. every request stops at the final confirmation card;
6. one Generate click produces one Automation job;
7. Preview opens the dedicated job detail page;
8. downloaded PDF and DOCX open successfully and contain source-grounded content;
9. refresh restores all states and links;
10. an unauthorized user cannot access the conversation file, preview, or artifact.

The feature is complete only when this flow succeeds without browser-console or API errors and direct Automation Studio behavior remains unchanged.
