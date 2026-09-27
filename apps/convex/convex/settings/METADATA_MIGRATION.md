# Workspace metadata and address ownership

## Registered legacy contracts and current boundary

`apps/api/plane/app/urls/workspace.py` registers `workspaces/` GET/POST and `workspaces/<slug>/` GET/PUT/PATCH/DELETE. `WorkSpaceViewSet.partial_update` admits workspace administrators; the serializer owns name (80), slug (48), organization size (20), timezone, logo/asset, and background color. `WorkSpaceSerializer` rejects reserved route slugs and names without letters/numbers or containing the bounded `contains_url` pattern. The native metadata validator shares these exact reserved segments and URL pattern across creation and settings. Slug spelling is preserved, including case and underscores, as in the inherited serializer; native names continue to trim surrounding whitespace.

Project settings are separate: registered `projects/<id>/project-views/` updates `ProjectMember` view/default props, preferences and order; `projects/<id>/user-properties/` owns a different `ProjectUserProperty` record used by the project listing sort. `preferences/member/<member_id>/` is a third exposed member preference boundary. These are not silently collapsed into workspace metadata or claimed implemented here.

## Production owner and rollout

The `workspaces` row owns name, unique indexed slug and metadata revision. `workspaceSettings` retains its existing organization/timezone/Summon settings ownership. All native production writes are `workspaces.index.create` and the single settings save owner; both initialize/advance the workspace revision. Settings values and workspace name/slug update in one transaction. Existing projects retain their own timezone after workspace changes.

Additive `settings.index.metadata` returns the complete editable settings snapshot, revision and `canManage` together. `update` requires the captured revision and slug and returns the new `{slug, revision}`. This prevents combining old fields with a newly observed revision. `slugAvailability` is an administrator-only advisory read; the mutation repeats indexed uniqueness inside its transaction. Failed validation, stale revisions and collisions leave both records unchanged.

The original `get` result and `save` argument shape remain solely for the currently served frontend artifact. Legacy save advances the same revision; it cannot rename a slug. Remove the old writer after the native editor is switched to required-CAS `update` and the new build is deployed. The additive optional `workspaces.metadataRevision` and zero-read compatibility were retired after bounded `backfillMetadata` completed on both hosts and second full scans reported zero changes. The field is now required; the migration entry point/read fallbacks and migration-only test are removed, and direct fixtures initialize the field. Existing absent `workspaceSettings` rows still legitimately mean default settings, independent of this migration.

## Address consequences

`navigation/address.ts` resolves the exact current slug through `by_slug`. Workspace membership, projects, task IDs, favorites and recent visits use stable workspace IDs. Native favorite/recent route builders read the current workspace slug. Successful editor save must navigate the `workspace` query parameter to the returned slug without dropping the remaining selected route parameters. No old-slug alias is created: the previous public address stops resolving. Inherited UUID-based domain routes are not rewritten by this slice.

## Evidence and remaining work

28 settings/address BDD pass after removing the obsolete backfill-only test, including an atomic settings+revision snapshot, renamed address/stable project identity, old-address rejection, stale-save protection, collision/invalid-timezone rollback, current member/guest/revocation boundaries, shared create/update validation and bounded idempotent backfill. Native TS7 and scoped Oxc/complexity pass. Additive artifact `36f7406b6d` passed immutable native TS7 and deployed on both hosts. Local backfill processed 13 workspaces, changed 12, then changed zero; remote processed two, changed two, then zero. Every pass finished. The durable receipt is `docs/migrations/convex/checkpoints/workspace-metadata-backfill.json`. Required-schema source and the editor are gated; browser rename acceptance remains pending.

Workspace logo/asset/background appearance, workspace deletion/recovery and owner transfer, instance workspace-creation policy, inherited REST/PAT compatibility, project rich settings and personal ordering/preferences remain explicit later contracts. This checkpoint does not claim full workspace settings parity.

## Editor cutover

The native settings editor now consumes the coherent metadata query, uses its `canManage`, captures its revision with the fields, and preserves the draft on failed saves. Slug edits warn that old links stop resolving. A successful mutation replaces only the `workspace` URL query parameter using the returned slug; the other navigation parameters remain. Field labels associate with controls. Native web TS7 and scoped Oxc pass. The no-CAS `save` compatibility writer must remain until the old production frontend on port 3023 is replaced with a build containing this editor; remove it at that coordinated checkpoint, not merely after local HMR activation.
