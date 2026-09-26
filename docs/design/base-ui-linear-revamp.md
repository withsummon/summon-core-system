# Base UI migration and work management

## Ownership and constraints

Base UI behavior belongs to `@plane/propel`; existing `@plane/ui` exports have live consumers throughout the app. Migrate their implementation without inventing a second interaction system. Feature owners retain permissions, store updates, validation, and navigation. No dependency upgrades or backend contract changes are part of this pass.

Task Center reads the existing accessible-project issue index, canonical project states, and members. Project directory reads Summon's home summary and the project store. Existing creation modals and issue routes remain mutation/detail owners.

## Inspected baseline and direction

The local Tasks screen was inspected in Chrome. It gives one task a full dashboard of repeated summaries, a calendar, a table, and blank panels; metadata falls to 8–11px. Choose a compact status-grouped work list with project, owner, priority and deadline alongside each title. Preserve the overview in useful group counts and filters. A permanent multi-panel dashboard was rejected because it displaces the work and repeats it. A board-only arrangement was rejected because it makes cross-project scanning harder; project-native board views remain available.

| Baseline | Inspected reference | Adaptation | Acceptance |
| --- | --- | --- | --- |
| Task list boxed between summary cards | [Linear grouped issues](https://mobbin.com/screens/e142df2a-3527-499c-8f81-1b715947ac0c) | Full-width status groups, compact rows | Titles and metadata align; no dashboard card stack |
| Large controls and redundant headings | [Linear project issues](https://mobbin.com/screens/937fc32e-04c6-4c39-bcd6-17a42b4fe83c) | Compact scope tabs and filter toolbar | Work starts immediately below toolbar |
| Secondary information always visible | [Linear display controls](https://mobbin.com/screens/815793b1-5c75-43ac-94c7-93380781e337) | Filters disclose on demand; collapse status groups | Keyboard opens controls, Escape restores focus |
| Portfolio KPI cards dominate projects | Same project/list references | List-first project directory with real health and completion | Long project names remain readable; narrow layout retains navigation |

## Primitive anatomy

Routes own scope/search/filter state and domain labels. Propel Button/Input/Select/Tabs/Collapsible own controls, keyboard and focus. Links own navigation. Neutral row layout owns responsive metadata placement; no generic feature-switching wrapper is introduced. Existing Lucide icons stay consistent with the installed library. Status icons retain text equivalents.

## Verification

### Implemented scope

- Shared behavior: menus/submenus/context menus, comboboxes, selects, popovers, dialogs, tabs, disclosures, switch, checkbox, input, avatar, tooltip, and scroll area now use the existing Propel/Base UI path. Main web, admin, public space, and editor direct legacy imports were migrated.
- Compatibility exports in `@plane/ui` remain because production callers still import them; they delegate to the canonical implementation. Native buttons/layout, charts, editor, calendar, drag-and-drop, and domain components remain where Base UI has no corresponding primitive. This is not a claim that every component or dependency in the monorepo is Base UI.
- Task Center is a grouped work list with ownership tabs, search, project/date/priority filters, and real work-item links. Project directory is a searchable list; project overview has a compact header, meaningful progress/activity, and property rail.
- Native ticket list retains its existing list/board/calendar behavior. Detail has bounded reading width and responsive properties; list actions and layout controls have explicit keyboard/accessible states.

### Evidence

Existing project/task domain tests pass (8/8). Propel, UI, editor, web, admin, and public-space TypeScript checks pass. Frozen-lockfile installation and shared UI builds pass. After the final dropdown/calendar changes, Propel and UI builds/typechecks, web typecheck, and the client/server production web build passed again. Changed-file lint reports zero errors and 121 warnings; diff whitespace checks pass.

Chrome checks covered project search/empty/reset, project tabs and profile editor, task filters/empty/reset, status collapse, single-selection search/keyboard, multi-selection, popup Escape/focus return, creation dialog naming, and switch keyboard toggle. Project/task layouts and native issue list/detail were inspected at desktop and 390px widths. Mobile sidebar route navigation and the list/board/calendar menu were exercised.

The closing keyboard check confirmed that New task focuses Title; searching Todo and selecting with ArrowDown/Enter updates the state; assignee selection keeps its multi-select open and Escape returns focus to the named trigger. Calendar arrow keys move by day, Escape closes the calendar and returns to Due date, and Discard returns to New task. Search fields are siblings of option lists, and calendar grids are in popovers rather than listboxes. No form was saved during these checks.

Local fixtures contain one project and one work item; high-volume rendering, populated milestones/resources, and every admin/public-space route have not been visually exercised. No task/profile save or destructive action was performed. Existing Vite configuration/MobX and lint warnings remain; passing checks do not establish every route's visual acceptance.

## Maintenance and provenance

The comparison is the working tree against `afe708b92370542e09dd065454337e3c83c08604`. Preexisting `.claude/launch.json` is untouched. No backend schema, API, generated-client, permission, or deployment changes are included.

| Class | Required surface | Why it is necessary |
| --- | --- | --- |
| Semantic | Summon tasks/projects and native issue presentation | Implements the selected list-first hierarchy, responsive details and actionable controls |
| Enabling | Propel owners and legacy UI entry points | One keyboard/focus/portal/selection owner replaces competing implementations |
| Mechanical | Direct web/admin/space/editor consumers | Maps real event, render-slot, selected-state and trigger contracts to those owners |
| Enabling | Sidebar state owner | Removes duplicate resize/collapse writers and hides inactive navigation from accessibility |
| Mechanical | Package manifests, Vite dedupe, lock importer entries | Removes dependencies made unused by the completed source migration |
| Deletion | Old button helper, dropdown keyboard hooks, obsolete overview source-string test | Removes superseded behavior and a test that only asserted obsolete presentation strings |

Removed redundant menu registries, outside-click listeners, positioning refs, mirrored disclosure state, nested buttons/links, and duplicated task/project dashboard panels. Raw Base namespaces are exported only through existing Propel entries for compound composition. The detached context-menu target ref remains required by live row/card callers; replace that opening adapter only when those owners can compose a native ContextMenu trigger around the target.

Rejected incidental dependency/peer-version changes from an unfrozen lock update; the final lock diff removes importer entries only. Existing dependency versions remain fixed. An unrelated `.sort()` to `.toSorted()` formatter suggestion was also rejected because the repository targets pre-ES2023 libraries.

No new dependencies, backend contract variants, or test infrastructure were added. New UI source is the canonical checkbox owner; this document records research and acceptance.

## Local review route

1. Open `/summon-local-qa-20260926/summon/tasks/`. Try ownership tabs, search, Filters → Priority, Clear filters, and collapse/reopen a status group.
2. Open New task. Search/select a state, select multiple assignees, open a date picker, and use Escape to dismiss each popup. Use Discard to leave the form; creation retains its existing draft/discard protection.
3. Open Projects from the sidebar. Search a nonmatching name and clear it, then open Northstar Delivery Browser Check. Review Overview and the resource tabs; open Edit project profile and Cancel.
4. Follow the project work-items link. Compare List, Board, and Calendar. Open a work item to inspect its reading area, property controls, and comment toolbar on focus.
5. Repeat at a narrow viewport (390px). The sidebar closes after navigation; project metadata wraps and ticket properties appear inline.

## Follow-up: motion and control sizing

The earlier migration completion wording was too broad. A browser inspection found the work-item dialog's `transition-[width]` overriding the shared opacity/scale transition, and legacy Button defaults at 24px beside 32–40px controls. Knowledge and generated-document previews still had manual modal shells.

Dialog now owns explicit 180ms entry/120ms exit keyframes with reduced-motion opt-out. Removed the task/intake width-transition overrides. Button and IconButton share 28/32/36/40px sizes; Task Center uses the same 32px toolbar size as Projects. Preview shells now compose Dialog, Button, and IconButton, with accessible titles and close labels. Existing domain copy/export behavior is unchanged.

Closing evidence: shared builds, Propel/web typechecks, and scoped lint (zero errors, 16 warnings) pass. Chrome computed styles confirm `dialog-in` at 180ms on task and opportunity dialogs; paired task footer actions measure 36px/13px text and opportunity footer actions 40px/14px text. Both dialogs were visually inspected and dismissed without saving. Preview content routes and every custom action across the product remain outside this visual coverage; this is not a blanket completion claim for all visual alignment.

## Follow-up: native dialog dismissal

Task and intake ModalCore callers omitted handleClose, leaving controlled dialogs open when Base UI requested outside/Escape dismissal. Task modal placement now belongs to its existing draft-protection layout; Base UI requests flow through editor readiness and save/discard handling. Intake uses its existing close/reset handler. Removed competing global Escape listeners from intake and task description editor. The discard prompt now uses Dialog.Title.

Chrome verifies empty task backdrop dismissal, dirty task backdrop/Escape prompting, Cancel retaining the unsaved title, and nested dropdown Escape closing only the dropdown. Test content was discarded without creating a record. Web typecheck passes; focused lint has zero errors and seven existing warnings. Intake close wiring is source/typechecked but not browser-exercised.

## Follow-up: project and sibling dismissal wiring

Create project had the same missing ModalCore close callback. Connected it and the remaining cycle, module, view, invitation, and estimate callers to their existing handlers. Webhook dismissal retains its existing generated-secret protection; estimate dialogs retain their pending-operation protection. Removed redundant global Escape listeners from those modal owners.

ModalCore.handleClose is now required, including the Manage widgets forwarding prop, so a caller cannot silently omit controlled dismissal. Shared UI build/typecheck and web typecheck pass. Scoped lint reports zero errors and 11 warnings. Chrome confirms Create project outside-click/Escape dismissal and independent Lead/Change cover popup dismissal. Other sibling fixes were source/typechecked, not individually browser-tested.
