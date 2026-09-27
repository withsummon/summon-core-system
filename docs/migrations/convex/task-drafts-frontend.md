# Native task drafts frontend

## Inherited owner and bounded composition

Inherited `issues/issue-modal/draft-issue-layout.tsx` prompts to save a draft when dismissing a changed create form. `issues/workspace-draft` lists private workspace drafts and offers edit, copy, remove, and move-to-project. The inherited properties include parent, cycle, modules, and estimates in addition to status, priority, assignees, labels, and dates.

The native slice is implemented as Tasks → Drafts with explicit saved edits and publication. Existing `TaskProperties` in `tasks/task-detail.tsx` is the production field owner to extract and reuse, with types derived from generated task update arguments. The backend owns canonical defaults, privacy, revision checks, relation validation, and atomic publication. Opaque JSON/binary fields will remain untouched by HTML-only edits.

## Experience selection

Inspected [Linear personal task list](https://mobbin.com/screens/671d22cf-69d7-4289-886c-f4e2f288f058) for compact title-first collection hierarchy and [Bonsai task editor](https://mobbin.com/screens/198fee93-c149-4525-86f4-615da0629953) for content-before-properties and explicit save actions. These images show ordinary tasks, not draft-specific semantics. A [Height form/list creation screen](https://mobbin.com/screens/559cb7f5-1ecf-489f-bc44-3dedfb51be47) was inspected and rejected as the decisive interaction because it creates lists rather than publishing a private task draft.

Inline editing in every list row was compared with a focused editor. The focused editor keeps the private collection easy to scan and gives rich content, captured relation revisions, project change confirmation, and conflict recovery enough room. Native shared buttons/fields/editor and established typography remain the visual foundation.

## Implemented boundary

Route: `module=tasks&taskSection=drafts`, with canonical raw `draft` selector for bookmarks/reload. Create asks the backend for its canonical empty record/defaults before editing. List pages remain bounded and sparse continuations visible. Editor saves only generated fields, preserves its opened revision and unsaved text across reactive lifecycle changes, and omits opaque description fields. The backend preserves those fields for unchanged HTML and clears incompatible opaque representations when HTML changes.

Task property controls are extracted once from TaskDetail and reused by both editors. Nullable status is exposed as project default at publication only in drafts. Project selection applies directly when no scoped selections would be lost. Otherwise explicit project-change confirmation clears state, assignees, labels, parent, cycle, and module selections while retaining content/global fields/captured draft revision. Parent/cycle/module choices are paginated and store the selected owner revision; unloaded or removed selections remain removable. No silent revision refresh occurs.

Copy is canonical backend copy. Trash/restore and publish capture the record at confirmation. Publication navigates with the backend-returned task and project identifier, clearing draft selectors. Backend transaction owns atomic identity, defaults, relation assignment, retry behavior, and permissions.

## Verification and remaining scope

Native web TS7, scoped eight-file Oxlint, project-change regression, and diff checks passed. The regression proves confirmed project changes clear scoped references without mutating original draft/content/dates/revision. Backend owner review and primary Chrome are separate gates. Primary Chrome should exercise blank/private creation, rich save/reload, property and relation retention, project change, copy, Trash/restore, stale edit/publish, successful publication, guest ownership, desktop and 390px.

Legacy implicit save-on-dismiss, estimates, and arbitrary relations remain closure items. Draft attachments and independent ready-file copying are implemented in the follow-on slice documented in `draft-attachments-frontend.md`. Native task estimates do not yet have an owner. Opaque data is preserved according to the backend contract but the native editor does not hydrate legacy binary/JSON. No dependency, commit, or deployment changes by this agent.

Root Chrome acceptance 2026-09-27 before attachment integration: created a private rich draft, saved project/default-state/high priority/assignee/label, reloaded its deep link in a second owner tab, and rejected foreign-account access. Concurrent title edits rejected stale save while preserving the unsaved title; cancel returned the current saved version. Copy retained content/properties; Trash and restore returned the copy. Publishing the original produced NSTAR-6 with the project default Ready for QA, high priority, Acceptance label, owner assignee and unchanged description. Original draft ID t578t67agydvmkd71d8z3njkd18f77tw, copied draft t57257vw4af6abx5jqn0r02pbs8f7nwg, published task k971391r8z3tat9jzyw6dhwe4d8f7yrv. A second draft t571tqe40nv776564fg917y2258f7mew captures parent NSTAR-6, Next release draft cycle and Quality evidence module for attachment/publication acceptance. Initial empty project selection now applies directly; confirmation is reserved for lost scoped selections. Desktop collection and 390px detail screenshots inspected; no horizontal overflow and controls wrap. Temporary viewport override reset. These checks do not yet cover draft files or the forthcoming copy action.
