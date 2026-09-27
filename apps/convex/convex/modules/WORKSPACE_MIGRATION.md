# Workspace module directory

## Existing contract and owner

Registered GET `workspaces/<slug>/modules/` is WorkspaceModulesEndpoint in
`apps/api/plane/app/views/workspace/module.py`, consumed by module.service.ts
getWorkspaceModules and module.store.ts fetchWorkspaceModules/fetchModulesSlim.
It requires workspace visibility and current active project membership; archived
projects/modules are excluded. Its ModuleSerializer includes metadata, lead,
member IDs, links and six aggregate issue counts. Those full REST projections
are not replaced by a count of loaded native task pages.

## Native bounded directory

`modules.workspace.list` uses the existing required workspace/project IDs and a
new by_workspace(workspaceId, deleted, archived) index. It shares requireWorkspace,
projectReader/projectSummary and pageBudget with the current workspace cycle
directory. Every candidate rechecks active project access; workspace admin alone
does not grant project visibility. The query returns newest-created metadata and
canonical project identity, preserving sparse page cursors. No project enumeration
or per-module task/roster/link fanout is introduced. No data backfill is needed.

The prepared native directory links directly to the canonical project identifier,
projectView=modules and projectModule ID. Existing scoped module detail owns
roster, links and authorized current progress with explicit coverage. Global
Modules navigation is separate from the seven inherited personal shortcut keys;
adding its global link does not mutate or truncate existing personal preferences.

## Evidence and limits

Three module-owned BDD scenarios cover archive/trash/project exclusions, canonical
project identity, guest membership and revocation, sparse continuation, foreign
workspace denial and page-size budget. Backend TypeScript 7 passes. Codegen log
workspace-modules-codegen.txt reports Uploading functions to Convex; this is not
an immutable deployment receipt. Exact archive 5656b1cf2b passed TypeScript 7 and deployed locally, including
the compatible OIDC rollback and removal of rejected custom JWT helpers. Log:
workspace-modules-5656b1cf2b-local-deploy.txt. The native directory is mounted
at /core?workspace=<slug>&module=modules through the global Modules link.
No browser acceptance or remote deployment is claimed.

Legacy aggregate counts and embedded roster/link projections remain a directory
wire-parity gap. Native scoped detail is the current supported route for those
features; no inherited route or service is retired by this slice.

## Primary Chrome acceptance

The primary inspected two workspace module rows on the local native frontend,
then followed Release readiness to its canonical project module detail with
progress, members and links. Desktop was readable. At390px, measured innerWidth
and scrollWidth were both390; rows, status and dates fit. The viewport override
was cleared. This is one-page read/navigation proof only. Sparse continuation
and ACL denial remain BDD evidence, not browser-tested claims.
