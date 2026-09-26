# Meetings backend owner review

The legacy meeting serializer/views own workspace/project permissions, participants and explicit work-item links. Native meetings.index and meetings.tasks preserve those boundaries using current membership checks. Meeting saves cannot change project while task links still point to the previous project. Links reference canonical task records; status reads remain live, and no meeting operation creates tasks automatically.

Review sampled access, save/participant replacement, task link/list/unlink and summary references. Retained participant responses now survive full record saves; the old serializer recreated them as pending whenever participant IDs were supplied. Revoked participants remain identifiable on an existing meeting and can be explicitly removed. Summary references expose the existing document ID only; reading document content independently rechecks its current ACL, including after visibility changes.

Module behavior cases cover cross-workspace/project denial, guest/revoked access, timestamp and URL validation, unique explicit task links, canonical task state, participant removal, preserved responses and private summary content. Full native backend suite reached 93 passing tests after review (later task changes add more). Frontend Chrome evidence is recorded separately.

Recording/transcript assets, transcription/LLM jobs, generated canonical summary bodies and export paths are not yet migrated. The schema supports a reference to an existing authorized summary document, not a fabricated generated summary.
