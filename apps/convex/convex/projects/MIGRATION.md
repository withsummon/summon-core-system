# Project metadata and recovery

## Owner and contract

`projects/create.ts` initializes name, immutable identifier, plain description and metadata revision. `projects/settings.ts` owns metadata saves and reversible archive/restore. Every settings/lifecycle mutation requires a captured revision; competing drafts fail without retry. Timezone remains independently versioned by its existing expected-timezone owner. Names retain native create validation (trimmed 1–120 characters); descriptions are plain text up to 20,000 characters. This slice does not expose HTML descriptions, identifier renaming, project deletion, lead/default assignee, public discovery or feature toggles.

`identity/access.ts` retains normal archived-project rejection before membership authorization. The extracted membership owner is reused only by lifecycle recovery to authorize an archived project. Active workspace and project memberships are both required. Settings/archive/restore require project admin and non-guest workspace access, matching existing native settings/member controls. This is deliberately narrower than Django metadata's workspace-admin override and Django archive's project-member permission; no additional access grants are introduced.

Archiving preserves the project ID, identifier reservation, sequence, memberships and children. Normal task access remains unavailable until restore; restored records keep their IDs and links. The paginated archived list includes only current active memberships and projects; ordinary members may see their archived project's label but cannot restore it. Filtered candidate pages may be empty and must retain the next-page control. Independent document owner/global access is unchanged: project archive is not a universal document confidentiality revocation.

## Stored-data transition

Existing project records predate `description` and `metadataRevision`. Both fields are temporarily optional in schema solely for this stored-data migration. Settings fail explicitly when either field is absent; no query-time invented defaults. Run every cursor page of internal `projects/settings:backfill` until `isDone`, retaining the receipt. It writes empty description and revision zero only for absent fields. Verify all records migrated, require both fields in schema, then remove the temporary backfill owner. New project and commercial handoff creation both use `createProject`, so always persist the fields.

## Verification

Module-local behavior tests cover metadata/lifecycle CAS, retained tasks and identity after archive/restore, reserved identifiers, last-administrator protection, ordinary-member and revoked-admin denial, workspace-guest denial despite stale project admin role, bounded pagination across filtered pages, and repeatable explicit backfill. Native types and focused lint are separate gates. Browser and deployed migration acceptance are recorded by the primary integration owner; this document does not claim them.

Workspace revocation or guest demotion must preserve a project administrator even when the project is archived. To change the final archived administrator, restore the project first, appoint another project administrator, then archive again if desired. Recovery never grants workspace administrators implicit project access.

## Primary integration acceptance

Local backend deployed at 08:33:01 on 2026-09-27. Metadata backfill updated 11 projects in one page; a second complete pass changed zero rows. Primary independently ran the root behavior command: 264 backend tests in 31 files and 19 frontend tests passed.

Owner review found and fixed a recovery invariant in the workspace membership owner: archived projects previously skipped last-admin protection. Workspace revoke/guest-demotion now cannot orphan their final administrator; tests cover the restore/appoint/rearchive recovery path. Archived query budgets explicitly reject invalid input. The archive UI states that documents retain their own access policy.

Chrome verified saved metadata, concurrent-write rejection with the old draft retained, archive removing an open task and module from owner/guest clients while workspace navigation survived, an archived list with admin-only restore, and restoration returning the original project identifier, metadata and existing task/comment content. A 390px recovery confirmation remained readable with scrollWidth 390; the viewport override was reset. The restored settings page was reloaded. No deletion, credential change or permission grant was performed in this browser journey.
