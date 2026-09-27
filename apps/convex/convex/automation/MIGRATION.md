# Automation preview and publication

## Owner and scope

Django's `summon/services/automation.py`, `automation_templates.py`, and
`page_document.py` define the baseline: editable templates, generation jobs,
preview before publication, and a project document created only after approval.
Native Convex templates/jobs now own that flow. Default templates are copied from
the legacy template constants, installed explicitly once per workspace, and never
overwrite a customized or retired default. Template edits use revision checks.

A generation job snapshots its template, input, destination project, selected
context, and citations. Requester/request ID deduplication prevents a lost response
from issuing another provider request. Provider absence creates an explicit failed
job, without a fabricated preview. The existing assistant provider adapter and
context authorization owner are reused. Provider errors are stored as bounded
codes, not raw responses or credentials. Authorization is checked again after the
provider returns and before publication.

Previews are requester-only and require current access to every selected source.
This deliberately tightens the legacy project-visible preview behavior to avoid
sharing private source material before approval. A paginated list filters revoked
candidates without losing its continuation cursor. Direct access remains denied.
The UI must name the destination project and state that publication shares the
result with that project's members before calling `publish.document`.

## Canonical document publication

The browser supplies only the job ID. The Node action derives HTML, JSON and Yjs
binary using `@plane/editor/lib`; it does not accept browser-produced binary.
Publication preserves the legacy escaped, verbatim Markdown in a preformatted
block. It does not claim to render Markdown as rich document blocks.

The internal mutation reauthorizes source and destination access, then calls the
existing document create and snapshot mutations in the same Convex transaction.
A failed snapshot rolls back both the document and publication link. A repeated
publication returns the same currently accessible document. Metadata retains
`viewProps.summon_document.kind` and `markdown`, and additionally records provider,
model, and citations. Generated content never invokes tools or executes writes.

## Verification

- Eight module behavior tests cover default preservation, duplicate names/stale
  revisions, missing provider, mock transport generation, explicit/idempotent
  publication, canonical binary/JSON/HTML roundtrip, transactional rollback,
  post-provider revocation, requester isolation, and revoked-page continuation.
- Actual local selfhost Node probe on 2026-09-27 returned Node v22.22.2.
  Pinned backend image:
  `ghcr.io/get-convex/convex-backend@sha256:b756b06641d15a55b5ec0692897ce5ad3715ddccfd02e1e213621e9e764255c8`.
- Actual local canonical editor probe produced 96 bytes with matching decoded
  JSON. Its first invocation logged a Yjs duplicate-import warning; the immediate
  repeat was clean. The inspected Node bundle contained one Yjs implementation.
  No cross-invocation Y.Doc objects are shared. The temporary probe was removed.
- Local functions were pushed at 06:53:39; subsequent authorization/metadata
  review changes still require the next coordinated push.
- Live provider generation is unverified: the local Convex backend has no
  configured provider key. Provider tests use synthetic fetch responses at the
  genuine adapter boundary. Remote deployment and browser acceptance are separate.

## Remaining parity

This slice does not migrate PDF/DOCX/XLSX/PPTX export, OCR/attachments, generated
artifact external downloads, automatic assistant planning, or meeting transcript
summarization. Source context includes explicitly selected project/client/meeting/
documents, not arbitrary external retrieval. Interrupted generation can remain
running; no automatic provider retry occurs. Publication is explicit and only
supports the native editable document format. Existing Django callers remain until
their native UI and acceptance checks are completed.
