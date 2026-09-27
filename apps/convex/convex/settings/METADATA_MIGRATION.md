# Workspace metadata and address ownership

## Registered legacy contracts and current boundary

`apps/api/plane/app/urls/workspace.py` registers `workspaces/` GET/POST and `workspaces/<slug>/` GET/PUT/PATCH/DELETE. `WorkSpaceViewSet.partial_update` admits workspace administrators; the serializer owns name (80), slug (48), organization size (20), timezone, logo/asset, and background color. `WorkSpaceSerializer` rejects reserved route slugs and names without letters/numbers or containing the bounded `contains_url` pattern. The native metadata validator shares these exact reserved segments and URL pattern across creation and settings. Slug spelling is preserved, including case and underscores, as in the inherited serializer; native names continue to trim surrounding whitespace.

Project settings are separate: registered `projects/<id>/project-views/` updates `ProjectMember` view/default props, preferences and order; `projects/<id>/user-properties/` owns a different `ProjectUserProperty` record used by the project listing sort. `preferences/member/<member_id>/` is a third exposed member preference boundary. These are not silently collapsed into workspace metadata or claimed implemented here.

## Production owner and rollout

The `workspaces` row owns name, unique indexed slug and metadata revision. `workspaceSettings` retains its existing organization/timezone/Summon settings ownership. All native production writes are `workspaces.index.create` and the single settings save owner; both initialize/advance the workspace revision. Settings values and workspace name/slug update in one transaction. Existing projects retain their own timezone after workspace changes.

Additive `settings.index.metadata` returns the complete editable settings snapshot, revision and `canManage` together. `update` requires the captured revision and slug and returns the new `{slug, revision}`. This prevents combining old fields with a newly observed revision. `slugAvailability` is an administrator-only advisory read; the mutation repeats indexed uniqueness inside its transaction. Failed validation, stale revisions and collisions leave both records unchanged.

The original `get` result and `save` argument shape remain solely for the currently served frontend artifact. Legacy save advances the same revision; it cannot rename a slug. Remove the old writer after the native editor is switched to required-CAS `update` and the new build is deployed. Optional `workspaces.metadataRevision` plus the explicitly marked zero read compatibility exist only until bounded `backfillMetadata` completes on both hosts and a second full scan reports zero changes. Then make the field required, remove backfill/read fallbacks and update fixtures. Existing absent `workspaceSettings` rows still legitimately mean default settings, independent of this migration.

## Address consequences

`navigation/address.ts` resolves the exact current slug through `by_slug`. Workspace membership, projects, task IDs, favorites and recent visits use stable workspace IDs. Native favorite/recent route builders read the current workspace slug. Successful editor save must navigate the `workspace` query parameter to the returned slug without dropping the remaining selected route parameters. No old-slug alias is created: the previous public address stops resolving. Inherited UUID-based domain routes are not rewritten by this slice.

## Evidence and remaining work

29 settings/address BDD pass, including an atomic settings+revision snapshot, renamed address/stable project identity, old-address rejection, stale-save protection, collision/invalid-timezone rollback, current member/guest/revocation boundaries, shared create/update validation and bounded idempotent backfill. Native TS7 and scoped Oxc/complexity pass. Deployment/backfill and browser rename acceptance are pending at this additive source checkpoint.

Workspace logo/asset/background appearance, workspace deletion/recovery and owner transfer, instance workspace-creation policy, inherited REST/PAT compatibility, project rich settings and personal ordering/preferences remain explicit later contracts. This checkpoint does not claim full workspace settings parity.
