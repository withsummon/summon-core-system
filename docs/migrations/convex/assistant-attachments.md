# Assistant text attachment slice

## Boundary

Legacy `assistant_attachment.py` binds owner-uploaded files to private conversations, limits unbound files to five, extracts documents, and sends audio to transcription. This slice supports **TXT, Markdown and CSV only**, at most 10 MiB per file, five unbound slots per conversation. Strict UTF-8 and nonempty readable text are required; extracted context is capped at 30,000 characters. PDF, DOCX, XLSX, PPTX, MP3/M4A and transcription remain unsupported. No new parser dependency is introduced.

## Owners and contracts

Assets remains the sole storage/checksum/authenticated-download/orphan-cleanup owner. Its new optional conversationId represents existing stored document/workspace assets without that field; it is not a permissive access fallback. Conversation-scoped assets require private conversation ownership, current workspace and selected-context authorization, and cannot also carry project/document scope. Tightening this field to an explicit nullable scope requires backfilling existing asset rows and updating all upload callers together.

`assistant.attachments.prepare` atomically reserves the slot and calls the existing asset preparation owner. Generic asset preparation rejects conversation scope, generic removal rejects conversation files, and document restore/duplicate require a matching non-null document ID. They cannot create a conversation attachment or bypass its slots. `attachment_upload.finalize` uses the existing size/checksum/signature finalizer, extracts text server-side, and only then marks the attachment ready. Metadata queries exclude extracted text. Failed or interrupted slots can be explicitly removed; upload tickets expire through the existing asset cleanup owner.

Reply requests explicitly include attachmentIds. The message transaction accepts only ready, unbound, same-conversation records, binds them to the user message, and includes attachment citations. Accepted request retries compare original content and attachment IDs and return the existing reply without re-running the provider; changed input under the same request ID is rejected. Missing provider configuration returns 503 before binding. Historical bound files remain source context, bounded to the latest 100 attachment records and the shared 30,000-character context limit; truncation is disclosed. Bound files cannot be removed independently. Deleting the conversation immediately denies downloads and schedules bounded attachment/asset retirement.

## Frontend

The existing composer owns upload activity and disables Send until the selected batch has settled and all remaining files are ready. The full selected batch is validated before uploading. Started transfers use allSettled so one failure cannot clear activity while siblings are still running. File rows expose processing state, failure and removal. Accepted messages show authenticated download actions. Existing AssetTransfers owns aborts and blob URL cleanup; credentials are sent in Authorization headers, never URLs. Attachment input and message draft remain after a provider-configuration failure.

## Verification

39 assistant/asset module tests pass, including private conversation isolation, project revocation, authenticated bytes, five-slot races, cross-conversation rejection, invalid/blank content, bounded extraction, atomic binding, idempotent accepted retries, changed-payload rejection, one provider call, 503 preservation, and deletion cleanup. Existing asset tests cover upload checksum/size ownership. Three frontend reply transport tests pass. Scoped Oxlint passes. Native backend types pass; final web typecheck and primary Chrome acceptance are separate gates.

This source slice was prepared without activating a deployment. No live LLM, Office/PDF extraction, audio transcription, or full legacy attachment parity is claimed.

## Primary Chrome acceptance

The 07:40:56 local deployment accepted a synthetic TXT upload through Chrome's native file chooser. The UI showed uploading/checking, then ready. Sending a question with no configured provider returned the real configuration error while retaining both the ready attachment and message draft. Reloading retained the ready attachment. No assistant message or generated answer was fabricated. Compact-width inspection showed the filename, state, removal control and composer within 390px without horizontal overflow. Successful live-provider binding/download remains unverified; backend and synthetic HTTP tests own those paths.
