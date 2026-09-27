# Personal project navigation

## Owner contract

The inherited `ProjectUserProperty.preferences.navigation` is the actual owner
consumed by `use-tab-preferences.ts` and project sidebar/header/tab navigation.
GET/PATCH `workspaces/<slug>/projects/<project_id>/user-properties/` always selects
the current user. `default_tab` defaults to `work_items`, and `hide_in_more_menu`
defaults to empty. Distinct ProjectMember preferences/project-views endpoints
remain separate legacy wire contracts; native private settings do not copy the
legacy member-ID cross-user write behavior.

The native `projectUserProperties.navigation` is an optional typed override.
Absence intentionally means no personal override, not missing migrated data.
`projects.navigation.get/save/reset` reuse current project/workspace membership
and the current-user index; guest members may manage their own preferences.
There is no target-user argument or administrator impersonation. Archived and
revoked project access rejects. Save and Reset capture the same revision used
by project ordering; neither overwrites sortOrder. Reset removes the navigation
field. Rejoining preserves the retained override via canonical membership grant
initialization. The underlying project-user row must exist; the D01 bounded
initialization/backfill remains a rollout prerequisite, with no fabricated row
or perpetual missing-owner fallback here.

Canonical defaults and supported tabs are exported from
`shared/project-navigation.ts`. Supported native destinations are Tasks, Cycles,
Modules, Views, Intake and an actual Overview renderer. Settings is not a
personal default key and remains reachable. Project pages and epics require
real destinations and are still excluded from this bounded native editor.
The stored schema rejects unsupported keys and duplicate hidden entries.

## Consumer boundary and verification

The frontend must apply the destination project's default only when no explicit
section or entity deep link is present. Explicit Tasks links carry
`projectView=tasks`, including navigation back to lists. Hidden tabs remain
reachable through More; default selection does not rewrite the URL in an effect.
Navigation customization captures a coherent query revision and retains drafts
on conflicts. Existing unowned filter/display/page preferences are not replaced
with a generic JSON settings store.

Four module-local behavior tests cover defaults/reset/order preservation,
private guest preferences and revoke/rejoin, ordering/navigation CAS conflicts,
and duplicate/archived/missing-owner rejection. Eleven combined navigation/order
tests pass; scoped Oxc passes. Backend b20b92537f passed exact-archive TypeScript
7 and deployed locally (project-navigation-b20b92537f-local-deploy.txt).

The native project consumer now uses the shared tab owner, renders Overview
separately, preserves hidden destinations in More, and captures form revisions.
Task links from favorites, notifications, saved views, cycle/module membership,
intake acceptance, hierarchy and lifecycle explicitly select Tasks. Two route
behavior tests cover default/deep-link precedence and stale selector cleanup;
all 52 frontend tests and native web TypeScript 7 pass. The existing unordered
project chooser remains active pending the separate D01 both-host backfill.
Browser acceptance and remote deployment are not yet claimed. No inherited
route is retired.

## Primary Chrome acceptance

On local3010, saved Cycles as Northstar Release's default and moved Modules to
More. The existing explicit module detail remained open. Switching to QA Delivery
Engagement showed its Tasks list; switching back to Northstar Release opened Cycles.
More exposed Modules and its click opened the module list. Explicit Tasks set
projectView=tasks and displayed tasks despite the Cycles preference. The actual
Overview destination rendered ProjectOverview.

At390px the navigation and customization form wrapped without horizontal overflow
(document width390); select, checkboxes, Save/Cancel/Reset remained visible.
Reset restored the original no-override state and Modules returned to primary
navigation. Temporary viewport override was cleared. This is local dev acceptance;
private cross-user/guest/revoked behavior remains BDD evidence. Remote activation
and underlying project-order initialization are separate gates.
