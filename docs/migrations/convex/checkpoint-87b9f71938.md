# Drafts, reactions and notifications checkpoint

Verified 2026-09-27. Source: `87b9f71938a0d1db363d62f28aad38d816ab6948`. Backend deployed from an exact Git archive to https://convex-core.withsummon.com; its private file/action endpoint is https://convex-site.withsummon.com. Both backend version and dashboard returned HTTP 200. This checkpoint does not change public frontend routing or retire Django.

## Immutable frontend and live journey

The production web build uses the remote Convex URLs. Preview: http://127.0.0.1:3020/core. Files: 1254. Tree SHA-256: `e78166ac46c1c861f066b4e772ea01276fe1299fe3ec2312ccb5030d28620518`. Index SHA-256: `c4817ad03f5c380a53a6b0d341fd4b3326924746880d9e6a70673ff172b76af9`; an HTTP fetch of the served `/core` matched it. Build copied to `/tmp/summon-production-87b9f71938-remote` before subsequent work. Existing unrelated editor/UI package manifests and lockfile changes remained outside these commits but were present in installed build dependencies.

Chrome fresh sign-in succeeded. Remote workspace `remote-browser-check-20260927` accepted private draft `sx7esebwyhbmcry0amv03kzn5h8f7cah`. A synthetic 103-byte text attachment uploaded while its text was being edited; save preserved both. Publication produced RQA-2, task `r5794cy1z38mg8ba6kp0nch6458f75t3`, retaining description and attachment. Authenticated download matched SHA-256 `fd76c055692ac5d38c48c90fad4d2f4e1393db04ea8e7f01469ece34a4924464`. Deep link: http://127.0.0.1:3020/core?workspace=remote-browser-check-20260927&module=tasks&project=RQA&task=r5794cy1z38mg8ba6kp0nch6458f75t3. Browser error log was empty for this flow. A separate authenticated runtime request verified profile access and the deployed mention-recipient policy.

## Local acceptance and gates

373 backend scenarios across 50 files, 33 frontend behavior tests, 30/30 native TS7 tasks, 21/21 lint tasks and 21/21 format tasks passed. Generated Convex bindings required Oxfmt after codegen. Existing lint warnings remain (web: 782 warnings, zero errors); no zero-warning codebase claim. Production web build passed. Native compiler/Oxc policy verifies version 7.0.2 across 22 manifests.

Local Chrome covered comment reaction add/remove and comment deletion/restoration across two actors; filtered mark-read affected exactly one selected mention and preserved nonmatching unread rows; private draft foreign-access denial, stale content save retention, copy/Trash/restore, same-tab upload plus text save, independent file copy, atomic publication and stale publication after concurrent file removal. Desktop and 390px draft surfaces were inspected; temporary viewport overrides were reset. See module receipts for BDD-only behaviors, including revoked upload/copy, multipage notification batches, pending-upload rollback, cycle/module publication and independent storage IDs.

Atomic commits: `e40c5e2a47` comment reactions, `df9aa63f3f` notification batches, `aa8ef219c1` canonical address queries, `2941884f3e` private draft backend/files, `87b9f71938` draft frontend. Earlier profile, stickies and task link/reaction commits are included. Commits used hooksPath=/dev/null after manual gates; hooks were not run. No push performed.

## Remaining gates

Full inherited parity and route consumer cutover remain open in `closure-ledger.md`. Draft autosave-on-dismiss, full legacy editor transport, unrestricted inherited attachment formats and external/PAT routes are not established by this slice. Auth providers/recovery, instance/public administration, imports/exports, webhooks, advanced layouts/analytics and remaining shared navigation contracts still have legacy owners. Remote backup evidence remains the earlier restore receipts; no new disaster-recovery drill or capacity benchmark is claimed. Existing benchmark comparisons remain directional with non-equivalent control/candidate contracts. Django/Postgres and workers remain active pending actual consumer and job retirement.
