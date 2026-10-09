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
The binary includes the editor title fragment, derived from the immutable job title,
and its roundtrip title is checked against saved document metadata.
Publication preserves the legacy escaped, verbatim Markdown in a preformatted
block. It does not claim to render Markdown as rich document blocks.

The internal mutation reauthorizes source and destination access, then calls the
existing document create and snapshot mutations in the same Convex transaction.
A failed snapshot rolls back both the document and publication link. A repeated
publication returns the same currently accessible document. Metadata retains
`viewProps.summon_document.kind` and `markdown`, and additionally records provider,
model, and citations. Generated content never invokes tools or executes writes.

## Verification and remaining acceptance

The [current parity receipt](../../../../docs/migrations/convex/current-parity-checklist.md#openrouter-provider-acceptance--2026-10-04) owns the current source, deployment and browser evidence. On isolated selfhost, actual OpenRouter `openai/gpt-4.1-mini` generated a source-bound invoice preview, rendered private DOCX/PDF through the independent document worker, and published one canonical Yjs document. A repeated publication returned the same document. Authenticated downloads matched file signatures and hashes; unauthenticated and unrelated-member requests were denied. The browser confirmed the completed job and downloaded the same PDF bytes.

Publication retains verbatim Markdown, as described above; the preview label now calls it Markdown source. Rich document conversion is separate product work. Full template/format/context/lifecycle acceptance, permitted real MCP execution, remote workers and activation, scheduled backup/restore and inherited route/API parity remain OPEN. Interrupted preview generation uses its existing scheduled expiration; provider requests are not automatically retried. Existing Django services remain until the retirement gates pass.

## Project generator source cutover

The registered project Automation document generator consumes the native template and requester-job owners. Project, type, status, and search predicates apply before the native continuation cursor. It does not collect all jobs or report loaded page counts as a full total. Template selection captures the actual revision; request-ID reuse is bound to all submitted generation inputs, including validated tone/detail preferences. Existing calls without preferences retain their original generation input. Format selection is a download preference, not a promise to manufacture a file type the renderer does not support; the real artifact list owns available formats.

Delete retires only the requester’s private preview and its generated-file access. The published project document remains owned by the independent document lifecycle. Current project, workspace, source, and requester authorization is rechecked at retirement, preview, publication, render, and file download. The optional `deletedAt` marker deliberately represents existing non-retired stored jobs by absence; it must remain optional until an explicit all-row retirement-state migration and required-schema rollout is approved. It is not a legacy identifier or public-shape alias. A retired request ID cannot trigger a new provider request. Running jobs cannot be retired; generation must finish or expire through its existing owner. Retirement captures completion, publication, and generated artifact identity so a concurrent render or publication requires reopening the command. No provider cancellation is claimed.

This source cutover has no new provider/runtime proof. Real generation, provider absence, repeated intent, rendering, publication, authenticated file bytes, running-job retirement denial and post-completion retirement, Guest/current source revocation, keyboard and constrained-width acceptance remain required.
