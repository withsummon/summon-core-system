# Project feature policy prerequisite

## Deployed source contract

Baseline `afe708b92370542e09dd065454337e3c83c08604` Project model defaults are cycle_view=false, module_view=false, issue_views_view=false, page_view=true and intake_view=false. The serializer exposes intake_view as inbox_view. `workspace/sidebar/project-navigation.tsx` uses these five flags to show Cycles, Modules, Views, Pages and Intake; `project/settings/features-list.tsx` edits the same fields. These are project configuration, not personal tab preferences or new authorization grants.

Inherited project partial_update permits a workspace administrator OR project administrator, rejects archived projects, and ensures a default Intake on enable. Native `projects.features` preserves that action-specific administrative capability. Ordinary readers still require existing project access; workspace administrators may inspect/edit the feature configuration without gaining ordinary project content reads. Deleted/archived projects and restricted accounts fail closed. Metadata revision CAS is shared with existing project settings and intake configuration.

The shared administrative predicate was moved from lifecycle to `projects/administration.ts` and reused without changing lifecycle semantics. Default-intake creation was extracted from existing intake configuration; enabling either path uses the same transactional owner. Disabling does not delete the intake or its tasks. `intakeEnabled` remains the single persisted intake flag; four other booleans live in project.features. No UI or guessed time-tracking/issue-type flags were added.

## Additive rollout

New projects receive source defaults. Existing rows have an optional features field solely for deployment compatibility; the new feature reader/mutation explicitly rejects missing migration data, with no ephemeral default projection. Operator-only backfill processes at most100 rows/1MiB per page, preserves existing intake settings and metadata, and is idempotent. Complete scans and second zero-change scans on BOTH hosts are required before making features required and deleting the backfill. Neither deployment nor backfill was performed in this slice.

Three BDD cases cover defaults, enabling/disabling with retained intake, stale CAS, workspace-admin configuration without ordinary project access, ordinary member denial, archived/restricted denial, and explicit idempotent backfill preserving intake. Native backend TypeScript and focused Oxc are the code gates. Existing production navigation integration and browser acceptance remain pending; deployed layout must remain unchanged.
