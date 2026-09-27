# Meeting text transcript and structured summary

## Canonical owners

The legacy owners are `meeting_transcript.py`, `meeting_summary.py`, and
`meeting_mom.py`. Native `transcripts` owns the raw source and its revision;
`runs` owns request identity, generation state, and post-provider authorization;
`mom` validates the seven required structured fields and renders the established
Summon MoM layout. Suggestions, party to-dos, and next actions remain document
text. This module never creates tasks or meeting-task links.

Transcript save creates one private document using the existing document create,
metadata update, and snapshot mutations in the same transaction. Only its owner
can replace raw source. The meeting points to that document; regeneration reuses
it. Generation and source replacement require that it is still private and owned
by the current actor; a document deliberately shared afterward must be made private
before those operations. This prevents newly selected private context from being
silently copied into a shared document. Once a transcript exists, normal meeting edits cannot detach its canonical document
or move the meeting to another project. Pre-transcript manual document links remain
unchanged. The read boundary additionally rejects a document whose project link
was changed elsewhere. This
avoids silently overwriting a different user-selected document.

The source table and `viewProps.summon_document.source_transcript` preserve the
original text after summary content replaces the visible transcript. Metadata
retains structured results, citations, language, provider, and model. The shared
Node `lib/documentConversion.ts` uses the existing `@plane/editor/lib` converter
for both automation publication and meeting transcripts/summaries. Browser input
cannot supply a generated artifact's binary. Document snapshot size limits remain
authoritative; oversized converted text is rejected transactionally.

## Concurrency and authorization

Save and summarize require captured meeting/source/document versions. The meeting
owner's timestamps now advance monotonically, including same-millisecond saves.
Summary completion checks all captured versions, current meeting/project/document
write access, document lock/archive state, and every selected context source.
A concurrent human document edit wins. No exception is used to substitute another
source after access changes.

Requester/request ID deduplication returns the original run, without another
provider request. One running summary is allowed per meeting. Explicit cancel
marks the run failed and rejects any late result; it does not claim to stop an
already issued provider request. An interrupted process can leave a running run;
its requester can cancel it before starting again. No automatic retry occurs.

The provider adapter is shared with the assistant. Missing configuration records
`provider_unconfigured`, preserving the source document. Invalid structured output,
revoked permissions, and stale state produce `generation_failed`, without storing
raw provider errors. JSON is requested in the prompt and validated strictly before
any document mutation; the adapter does not request a vendor-specific structured
response format.

## Evidence and remaining parity

Eighteen module behavior tests exercise private source creation, stale save rejection and meeting-form conflict retention,
missing provider, strict output validation, source-preserving canonical conversion,
idempotency, one in-flight run, cancellation/late replies, post-provider revocation,
concurrent document edits, another admin's private-document denial, transactional
snapshot rollback, shared-document write rejection, pre-conversion size checks, and regeneration without duplicate documents. The existing
meeting and automation suites run alongside this slice.

No live provider call was performed for this slice. The corrected functions were deployed locally at 07:50:57 on 2026-09-27. Transport tests
use synthetic responses at the genuine provider adapter boundary; editor conversion
and Convex mutations are real test implementations. The native UI adds source editing, explicit canonical-content replacement approval,
shared context controls, persisted missing-provider failure, cancellation, and a
link to the canonical document. Primary Chrome acceptance is recorded below.

Asset/audio transcription, OCR, external transcript ingestion, token usage
accounting, and export formats are not implemented here. Plain transcript input is
bounded at 120,000 characters, but the canonical document's HTML/JSON/binary limits
may reject a smaller highly escaped input. Context sent to the model is capped at
30,000 characters and records truncation. Rendered MoM preserves the established
Asia/Jakarta time and Indonesian section conventions.

## Meeting form conflict handling

Existing meeting saves require the captured `expectedUpdatedAt`. The form retains
its original revision alongside the draft and shows the canonical conflict error;
it does not silently refresh the revision or retry. Cancel and reopen loads the
new meeting state. This prevents an old form from erasing a newly linked transcript.

Unchanged private-document references do not block shared meeting edits. The meeting
owner validates document access only when adding or changing a link; a project
collaborator can update the agenda while retaining the organizer's private source
reference. The collaborator still cannot read or summarize that source. Approval
in the summary UI captures its source/document version tuple; later reactive
updates do not silently change the version the user approved.

## Editor title and CRDT replacement

The generated document producer includes both the `title` and `default` Yjs
fragments. Titles come from the server-owned meeting/job names, with one meeting
title helper shared by conversion and metadata persistence.

Replacement loads the captured canonical snapshot into the existing editor Yjs
owner, deletes both existing fragments inside that document transaction, and
inserts the replacement through y-prosemirror. The resulting update includes the
deletions needed by already-open collaborative editors. It does not merge a fresh
independent document into the old body. Final CAS still rejects a persisted change
after the captured snapshot. Integration tests apply the replacement to the old
bytes and compare with a reopened document, proving old text/title do not reappear.
Both transcript replacement and generated minutes assert editor title equals saved
metadata; automation first publication has the same title agreement assertion.

## Primary runtime and Chrome acceptance

The owner saved a supplied transcript, creating its private canonical document. With another tab holding the older meeting form, saving its edited agenda failed with the expected conflict and retained that draft. A genuine generation request without provider configuration persisted the failure while retaining the source and original linked task. An independent peer could read the meeting but received a transcript-specific unavailable boundary without seeing the private source.

Initial Chrome inspection found a producer bug: generated body bytes omitted the collaborative title fragment. Review also found that replacing content with a new independent CRDT would merge old content back into an open editor. Both were corrected at the existing editor conversion owner: new documents include their intended title; replacements load captured bytes, delete/replace both fragments transactionally and retain deletion markers. Eighteen summary tests now include applying the replacement to an existing open Y.Doc and comparing it with a fresh reopen; automation tests verify title agreement too.

After the corrected deployment, Chrome kept the old transcript open in one owner tab while another saved replacement text. The open editor changed to the intended title and only the replacement body, with no old text duplicated. A full reload retained that exact title and body. The synthetic document is `md74zwkr848r9xg75qcdx2ddtd8f7b73`. The complete backend suite passed 236 tests. Compact 390px inspection showed usable summary controls and linked-task controls. Live model generation, audio transcription, remote hosting and every legacy document feature remain unverified or unmigrated as stated above.
