# Native project Modules frontend

## Domain and implementation owners

The legacy `components/modules/form.tsx`, `select/status.tsx`, and Django Module model establish the module's six statuses, lead, roster and independent dates. Modules are distinct from cycles: task links are many-to-many, no phase calendar or overlap check applies, and one date may be unset. The native backend owns name uniqueness, sanitation, ACL, lifecycle and mutation versions.

`convex-core/modules/modules.tsx` owns list, canonical detail and lifecycle confirmation. `forms.tsx` owns metadata and rich description as a captured draft. `members.tsx` owns roster changes; `tasks.tsx` owns additive task links and removals. The project shell selects this module lazily. Existing SummonField, Propel controls, numeric type tokens and TaskRichEditor provide the visual/editor foundation. No generic cycle/module adapter or legacy Django provider was introduced.

## Route and behavior

Open `/core?workspace=<slug>&project=<identifier>&projectView=modules`. Detail adds `projectModule=<id>`; Trash adds `moduleView=trash`. The separate `projectModule` parameter avoids the workspace's existing `module` navigation parameter. Raw IDs resolve through the canonical backend query and must match the selected authorized project. Invalid/revoked detail has a local Back to modules recovery.

Creation/editing includes name, six statuses, nullable lead, independent start/target dates and rich description. If both dates exist, the start cannot exceed the target. The draft captures its initial record and revision, including rich HTML; concurrent changes do not reset user input or silently retry. Stored lead identity is rendered from the detail projection even when it is outside the first directory page. An unchanged historical lead remains available as the current selection; new choices come from current authorized project membership.

Roster changes are separate versioned operations and can include guests. Neither lead nor roster membership grants access. Task linking uses the selected task's captured revision plus the opening module revision. It keeps other module memberships unchanged, with this consequence visible before confirmation. Removal and lifecycle confirmations capture versions when opened. Current capability projections control buttons, while the backend authorizes every write.

Completed and cancelled modules can be archived. Creator/project admin with current write access can move modules to Trash and restore them. Restore may reject a conflicting name. Deleted module details retain metadata, but hide roster/task queries until restored. Lists use bounded pagination: 30 modules and 50 member/task choices per request, with explicit Load more; no inferred total or capacity claims.

## Verification

- Native web TypeScript 7 typecheck passed.
- Scoped Oxc lint: zero warnings/errors across four Modules files and the project shell. Diff whitespace check passed.
- Module-local backend BDD covers domain and authorization behavior; the primary owns the final integrated test receipt.
- Primary Chrome acceptance is pending: create with only one date, rich formatting persisted, duplicate-name error, lead and guest roster changes, same task linked to two modules without a move, link removal, two-tab stale metadata/roster/task/lifecycle drafts, completed/cancelled archive, Trash restore, guest read-only detail, mismatched project URL, desktop and 390px layout.

No deployment or commit was performed by this frontend task. Rendered functional and visual acceptance are separate from source/type checks.

## Remaining parity

This slice does not implement module links, favorites/recent visits, progress/distribution reporting, Gantt/calendar views, personal filters/layout settings, bulk task transfer, external import metadata, rich-description attachments or collaborative rich-description editing. Backend task membership event projections and legacy route/API retirement retain their separately documented limitations. This is not a claim of full Plane module parity.

## Primary local acceptance

Backend deployed at 08:20:53 on 2026-09-27. Primary source review sampled canonical ACL, name uniqueness/restore conflicts, lead and roster membership validation, independent task links, revisions and shared sanitizer ownership. Full 30-task native type gate passed. Running behavior tests concurrently with that gate initially failed while the type pipeline rebuilt/cleaned shared package output; the sequential rerun passed all 256 backend tests and 19 frontend tests. This transient run is not a product regression or performance sample. Build-producing gates and runtime tests must run sequentially.

Chrome verified creation with a target date and no start date, rich description, guest lead and roster addition without write access, realtime task visibility, stale metadata rejection with draft retained, completed-module archive removing edit controls, unarchive, Trash discovery/restore with roster and task link retained, and the same task linked independently to two modules. Removing it from the second module preserved the first link. A 390px inspection found an unnecessary empty-description editor box; the detail now omits it, and the corrected layout remained within 390px with readable actions. Temporary viewport state was reset.

Live remote acceptance, provider integrations and remaining legacy feature parity are not implied by these local checks.
