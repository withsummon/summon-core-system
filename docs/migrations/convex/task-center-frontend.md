# Workspace Tasks frontend closure

The native Tasks module now consumes the existing bounded `tasks.center.list` owner. It retains the legacy Summon task center's My tasks, Team tasks, Created by me, All tasks, due date, priority, project, and text search controls. Filters are explicit form submissions and live in the URL. Team tasks means tasks with any assignee, matching the existing owner; it does not invent a separate team-membership rule.

The existing legacy route delegates to `components/summon/tasks/tasks-root.tsx`, which fetches accessible issues then filters/groups in the browser. This native route makes one workspace task query plus the authorized project directory; it does not fetch every project's task list. A flat responsive result list avoids implying complete group counts while scanning bounded pages. Each row carries canonical project identity, task identifier, custom state, priority, and due date. No page size is presented as a workspace total.

Filtered pages may be empty while a continuation exists. Load more remains available until exhaustion. Unavailable project filters produce an explicit recovery state rather than silently broadening to all projects. Local calendar date refreshes at a minute boundary/focus for due-date filtering; unchanged date strings do not reset pagination.

Opening a result records the canonical project identifier and task ID in the URL and reuses TaskDetail with that authorized project's role projections. The detail owner verifies the resolved task belongs to the selected project. Back to tasks retains filters; refreshing the deep link opens the same task. Creation routes to the existing project task form after selecting a writable project filter, rather than duplicating the creation owner. A standalone cross-project creation modal, full legacy grouping, bulk actions, and avatar directory are not claimed.

Scoped Oxlint passes. Native web typecheck and primary Chrome acceptance are separate gates. Existing backend task-center behavior tests cover scope/due/priority/search, inaccessible projects, and continuation through an empty filtered page. No backend contract changed in this frontend closure.

## Primary Chrome acceptance

The Northstar workspace Tasks view returned the assigned task under My tasks. All tasks with project NSTAR and high priority returned the expected single task; opening it and going Back preserved applied filters. At 390px the filters stacked and the task title/status/date remained readable without horizontal overflow. A task ID paired with a different accessible project identifier returned the shared unavailable state before rendering content or write controls.
