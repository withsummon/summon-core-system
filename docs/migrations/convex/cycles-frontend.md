# Native project Cycles frontend

## Scope and owners

The native Core Projects view now offers Tasks and Cycles. The existing Plane cycle form remains the domain reference: name, description, paired dates, project scope, assignment, archive and deletion. This slice reuses Core typography, SummonField, Propel controls and generated Convex APIs; it does not mount the legacy MobX/Django cycle stores.

Implementation owners are `convex-core/cycles/cycles.tsx` (list, canonical detail and lifecycle), `forms.tsx` (captured metadata and timezone drafts), and `tasks.tsx` (membership confirmation). `core-workspace.tsx` only selects the project subview. The Convex package exports its existing pure `cycles/dates.ts` as `@summon/convex/cycle-calendar`; calendar calculations have one owner shared with the backend.

## Public flow

- Open `/core?workspace=<slug>&project=<identifier>&projectView=cycles`. Detail adds `cycle=<canonical-id>`; Trash adds `cycleView=trash`. Navigation updates search parameters without replacing unrelated workspace state. Raw cycle IDs resolve through the normalized backend query and must belong to the selected authorized project.
- Create a draft with both dates empty or schedule with both dates filled. Date controls constrain the pair; canonical backend validation owns valid dates and overlap rejection. Detail displays the cycle's captured timezone. Project timezone editing affects future cycles only.
- Metadata edits capture their opening revision. Assignment captures the target cycle revision and the selected task revision; removal captures both revisions when opening confirmation. Lifecycle actions capture revision when chosen. Timezone editing captures the opening timezone. Conflicts retain the draft and explicit error; no automatic stale-write retry occurs.
- Guest controls are omitted using current membership and backend capability projections. Completed cycles can be archived; authorized creator/admin can move to Trash and restore. Restore preserves remaining memberships and can reject schedule conflicts. Task links return to the project's canonical task detail.

## Real-time clock and bounded reads

List pagination has stable query arguments. A minute-boundary timer plus focus/visibility-resume refresh computes display phase using the shared calendar function. Timer and listeners are cleaned up on unmount. Detail also keeps its query clock stable so an argument refresh cannot unmount an active draft. Current display phase only narrows backend `canEdit`; it never converts denied authorization to permission. Mutations always enforce actual server time and current ACL. No query data or authorization cache was introduced.

The list loads 30 cycles per page, membership and task choices load 50 per page, with explicit Load more. No project fanout or guessed totals. Server capacity errors remain visible: 200 nondeleted cycles per project, 100 memberships per cycle. The membership form states its 100-task limit.

## Verification receipt

- Native web TypeScript 7 typecheck passed. Scoped Oxc lint: zero warnings/errors across the three cycle modules and project shell.
- Existing module-local backend BDD suite: 11 passing cases, including date/timezone boundaries, CAS, access, membership moves, lifecycle and bounds.
- Browser acceptance is pending primary QA. Required checks: owner creates draft and scheduled cycle; paired-date/overlap rejection; two-tab stale metadata/assignment/timezone conflict retaining input; move/removal reflected in both cycles; archive completed cycle; Trash restore; guest read-only controls; wrong-project deep link; desktop and 390px layout. Minute transitions should preserve an open form and loaded list depth.

## Remaining parity

This is not complete legacy cycle parity. There is no bulk unfinished-task transfer, burndown/distribution reporting, progress snapshot, favorites, rich cycle logo, personal sorting/filter/view configuration, workspace cycle dashboard, public API compatibility or legacy route retirement. Existing project timezone backfill must be completed before these screens can operate on older native projects. Production performance and deployment identity are outside this frontend receipt.

## Primary Chrome verification

The 08:09:05 local backend deployment and completed timezone backfill were exercised at `/core?workspace=northstar-convex-qa&project=NSTAR&projectView=cycles`. Owner creation/date update, task assignment, guest realtime read-only view, conflicting edit with draft retention, Trash recovery, moving one task between cycles, and removing membership passed. Compact 390px controls were readable without horizontal overflow. The original task remains in the project; cycle changes do not delete it.

Review caught and fixed an assignment disclosure race: confirmation now waits for the current-membership query to settle before allowing a move. Shared phase calculation advances on minute boundaries/focus/visibility without changing pagination/detail query arguments or discarding forms. Server write authorization and lifecycle checks remain authoritative. The full archive/clock-transition UI matrix and remote acceptance are not claimed.
