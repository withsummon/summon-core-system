# Canonical native navigation addresses

## Source and ownership

Inherited `app/(all)/[workspaceSlug]/(projects)/browse/[workItem]/page.tsx` splits the route segment on `-` and passes the first two pieces to the issue detail store. `IssueDetailIdentifierEndpoint` in `apps/api/plane/app/views/issue/base.py` resolves project identifier case-insensitively within the workspace slug, parses an integer sequence and verifies project membership. The UUID detail page separately calls `getIssueMetaFromURL` and redirects to this browse address.

Native addresses retain strict `requireUser`, `requireWorkspace` and `requireProject` ancestor authorization. Ordinary task reads reuse `taskCanRead` and `taskDetail`; triage reads reuse `intakeCapabilities` after the existing `intakeTasks.by_task` bridge lookup. `tasks.by_project_sequence` owns exact task lookup. Sequence allocation stays in the task creator; no membership policy, identity conversion or stored-value backfill is added here.

## Public generated contract

- `navigation.address.resolveWorkspace({workspaceSlug})` returns `{workspace, role}` after current membership authorization; slug spelling is exact.
- `resolveProject({workspaceSlug,projectIdentifier})` returns `{workspace,project,workspaceRole,projectRole}` with the canonical project document. Identifier matching uses the native project's uppercase spelling, within the resolved workspace only.
- `resolveTask({workspaceSlug,workItem})` returns `null` or the common address `{workspace:{id,slug,name},project,workItem}` plus one generated variant below. `project` is the same canonical `Doc<"projects">` published by `resolveProject`, including `_id`; consumers need no project mapper or global-list lookup.

| Kind     | Additional native result                 | Read owner                                                                                                                                                                                                                |
| -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `task`   | `{kind:"task",task}`                     | Canonical `taskDetail` with capabilities after `taskCanRead`. Archived ordinary tasks remain readable and readonly; deleted tasks and triage are excluded.                                                                |
| `intake` | `{kind:"intake",intake:{taskId,status}}` | Live triage task and live bridge, then `intakeCapabilities(access,intake.createdBy).canRead`. Only routing identity and the schema-owned Intake status are published; the full submission remains at `intakes.index.get`. |

Both branches require current workspace and project memberships and a live project. Ordinary tasks allow non-guests, the task creator, or readers enabled by `guestViewAllFeatures`. Intake allows non-guests, the actual Intake creator, workspace/project administrators, or readers enabled by that flag. These role rules add no project membership bypass. Archived/deleted triage tasks, missing/deleted bridges, denied reads and missing tasks return `null`; malformed addresses and missing/revoked ancestors retain strict errors.

Lowercase identifiers and leading-zero sequences are accepted and canonicalized in `workItem`. Native addresses require a 1–12 character project identifier and positive safe-integer ASCII sequence. External URLs, suffix segments, whitespace, negative/zero/fractional/unsafe sequences and Unicode digits are rejected.

## Cutover boundary

The registered Browse page still uses Django; no frontend consumes `resolveTask`, and no native Browse route is registered. The inherited `is_intake` lookup covers pending/snoozed submissions and redirects to `/{workspaceSlug}/projects/{projectId}/intake/?currentTab=open&inboxIssueId={taskId}`. That existing open-tab journey is the pending/snoozed routing owner to preserve. The native result exposes actual Intake status without guessing rejected/duplicate destinations; those mappings and any accepted-triage inconsistency remain open. Accepted submissions admitted to an ordinary task follow the `task` branch.

Preserved shell, detail layout, Peek, dialogs, commands and UUID-to-Browse navigation still need native integration and rendered acceptance. The legacy browser's permissive split and Django's negative/Unicode integer parsing are not native address contracts. Native identifiers disallow hyphens; inherited UUID bookmarks still need an explicit identity owner rather than casts.

## Verification

Current source checks cover strict lint/complexity, formatting and generated union inference: canonical project reuse, `kind` narrowing, native Intake task ID/status and canonical task detail. Earlier BDD receipts describe a prior resolver and do not prove this union or route integration. Current native runtime, Intake status routing and Chrome acceptance remain open.
