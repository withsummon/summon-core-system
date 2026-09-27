# Task and intake description history

## Boundary and reuse

`tasks/description-history.tsx` owns one shared history dialog for generated task/intake scopes. Task rich description and intake detail provide their canonical task ID. Existing Propel Dialog owns focus and dismissal; existing TaskRichEditor renders saved HTML read-only. The legacy page history was inspected for date-first version selection, but its Django store/SWR bindings are not imported.

The capability query owns history-specific guest access and restore permission. A denied capability mounts no history list. Deleted task and removed intake views do not render this control. The list is bounded to 30 candidates with explicit load more, and selection uses a generated version ID.

## Restore approval

Selecting a version previews its canonical HTML. Opening restore confirmation captures that version's revision and HTML together with the current task and optional intake timestamps from the capability owner. The preview remains frozen while confirmation is open. Incoming updates do not replace approved content or silently refresh expected revisions. Backend conflicts retain the confirmation and error; cancellation is explicit. A successful mutation closes the dialog and existing subscriptions update the description.

This restores description content only. It does not claim task activity, comment, or document-version history parity. Actor IDs are not expanded through an unrelated membership directory; rows show the saved timestamp and revision.

## Verification

Native web TS7, scoped seven-file Oxlint, diff whitespace checks, and five backend history behavior tests passed. Backend owner review and primary Chrome acceptance are separate gates. Chrome journeys: task and intake saved-version preview; explicit restore; stale task, intake, and coalesced-version conflict; guest visibility restriction; archived task read-only history; keyboard dialog dismissal and desktop/390px layout. No deployment or commit was performed by the frontend agent.

## Primary verification, 2026-09-27

Primary gates passed: 301 backend tests across 36 files, 19 frontend tests, 30 native TypeScript tasks, 21 lint tasks and 21 formatting tasks. Local functions deployed at 13:23:40 Jakarta time.

Chrome verified administrator and creator edits create separate versions, then a same-creator edit coalesces to revision 1. A captured restore was rejected after that peer edit, preserving the approved preview and newer current content. Cancelling and recapturing restored the selected older description successfully. Accepting NSTAR-5 and following its ordinary-task link retained all three history entries with the same task ID. Desktop and 390px history-dialog screenshots show readable version selection, preview and restore controls without page overflow; viewport override was removed. Exact 600-second boundaries, archived/deleted/revoked access and mutable-version CAS remain automated-test evidence. No remote deployment or production frontend build is claimed for this slice.
