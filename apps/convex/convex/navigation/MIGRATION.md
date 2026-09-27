# Canonical native navigation addresses

## Source and ownership

Inherited `app/(all)/[workspaceSlug]/(projects)/browse/[workItem]/page.tsx` splits the route segment on `-` and passes the first two pieces to the issue detail store. `IssueDetailIdentifierEndpoint` in `apps/api/plane/app/views/issue/base.py` resolves project identifier case-insensitively within the workspace slug, parses an integer sequence and verifies project membership. The UUID detail page separately calls `getIssueMetaFromURL` and redirects to this browse address.

Native address queries use existing `requireWorkspace`, `requireProject`, `requireTask(read)` and `taskDetail` as permission and lifecycle owners. No new membership policy or role synthesis exists. `tasks.by_project_sequence` performs exact indexed lookup; sequence allocation remains the canonical task creation owner's responsibility. Adding the index changes no stored rows or identities and requires no value backfill.

## Public generated contract

- `navigation.address.resolveWorkspace({workspaceSlug})` returns `{workspace, role}` after current membership authorization; slug spelling is exact.
- `resolveProject({workspaceSlug,projectIdentifier})` returns `{workspace,project,workspaceRole,projectRole}`. Identifier matching uses the native project's canonical uppercase spelling, within the resolved workspace only.
- `resolveTask({workspaceSlug,workItem})` returns `{workspace:{id,slug,name},project:{id,identifier,name},workItem,task}`. `task` is the canonical detail projection with capabilities, not a legacy `TIssue` imitation. Lowercase identifier and leading zero sequence are accepted and canonicalized in returned `workItem`. Complete native addresses require the native 2–10 character project identifier plus positive safe integer ASCII sequence. External URLs, suffix segments, whitespace, negative/zero/fractional/unsafe sequences and Unicode digits are rejected.

Current archived tasks remain readable and readonly; trashed tasks and reserved triage tasks are hidden. Archived projects are unavailable. Guest ownership/guestViewAllFeatures rules and both workspace/project membership are enforced by the task owner. Workspace administrators receive no project membership bypass. Failure exposes no task title/body. Distinct permission/not-found error messages preserve existing access-owner behavior; identifier-existence indistinguishability is not claimed.

## Cutover boundary

This is the backend owner for future inherited navigation consumers, not a completed route cutover. No frontend or legacy route was redirected. The legacy browser's permissive split (discarding extra segments) and Django's negative/Unicode integer parsing are intentionally not reproduced for native sequence addresses. Native identifiers already disallow hyphens. Legacy UUIDs are not cast or guessed into native IDs; imported/external bookmarks still require an explicit identity map. Intake routing needs its authorized intake owner rather than bypassing ordinary task ACL. Public/PAT endpoints, session bridging, inherited preferences and full issue detail/list DTO parity remain separate closures.

## Verification

Twelve module-owned BDD cases pass: canonical case/leading-zero identity, duplicate project identifiers/sequences in separate workspaces, anonymous/outsider/admin-without-project denial, guest ownership and flag permission, revoked project membership, archived/task-trash/triage/project-archive behavior, malformed/external addresses. Scoped Oxlint passes without warnings. Native TypeScript 7 typecheck passes after concurrent draft-copy API changes settled. No deployment or browser acceptance is claimed.
