# Native project settings and archive recovery

## Owners and behavior

`convex-core/projects/settings.tsx` renders canonical project metadata and capability flags from `projects.settings.get`. The edit form captures name, plain description and metadata revision when opened; an update arriving while editing does not reset the draft or advance its saved revision. The project identifier is displayed as immutable. The existing ProjectTimezone component remains the sole UI for the independent timezone contract.

Project administrators with current write access can archive from an explicit confirmation that captures the opening revision. The consequence is stated before confirmation: child records are retained, while normal project work is unavailable until restored. Successful archive navigates to the workspace's archived-project view.

`projects/archived.tsx` reads the canonical archived list in 50-candidate pages. A filtered empty page still offers Load more until the server reports exhaustion. It renders only the backend's `canRestore` capability; restore confirms with a captured revision. Successful restore opens that project's Settings view. No inferred workspace-admin override, total, client-side unarchive flag or automatic conflict retry was introduced.

`projects/boundary.tsx` scopes active project query failures to the project content, preserving the project selector and workspace navigation. A selected identifier absent from the active directory offers archived-project recovery instead of unexpectedly rendering project creation. This handles archive arriving from another client as well as local archive/query ordering. The backend remains the authorization owner; the boundary does not infer why a project is unavailable.

## Routing

- Settings: `/core?workspace=<slug>&project=<identifier>&projectView=settings`.
- Recovery: `/core?workspace=<slug>&projectView=archived`.
- The project header exposes Archived projects for all current workspace members; visible records and restore controls are server-filtered.
- Archive navigation clears selected project/task/cycle/module child parameters and preserves unrelated workspace route state. The four project-section buttons wrap at constrained widths.

## Verification

Native web TypeScript 7 passed. Scoped Oxc lint reported zero warnings/errors across the three project files and project shell. Diff whitespace check passed. The module-local backend project-settings suite passed 5 cases; integrated backend and backfill gates remain primary-owned.

Browser acceptance is pending primary QA: edit name/plain description; verify immutable identifier and timezone reuse; retain stale metadata draft after a concurrent save; archive with a child task open in another tab; verify workspace navigation survives and task work is denied; restore with retained child content; member/guest view without admin controls; filtered empty archive pages; desktop and 390px layout.

No deployment or commit was performed by this frontend task. Existing native projects require the backend's explicit metadata backfill before settings reads; there is no frontend default hiding an incomplete migration. Existing settings such as project visibility, estimates, issue features and external integration metadata are outside this bounded slice.

## Primary integration acceptance

Local backend deployed at 08:33:01 on 2026-09-27. Metadata backfill updated 11 projects in one page; a second complete pass changed zero rows. Primary independently ran the root behavior command: 264 backend tests in 31 files and 19 frontend tests passed.

Owner review found and fixed a recovery invariant in the workspace membership owner: archived projects previously skipped last-admin protection. Workspace revoke/guest-demotion now cannot orphan their final administrator; tests cover the restore/appoint/rearchive recovery path. Archived query budgets explicitly reject invalid input. The archive UI states that documents retain their own access policy.

Chrome verified saved metadata, concurrent-write rejection with the old draft retained, archive removing an open task and module from owner/guest clients while workspace navigation survived, an archived list with admin-only restore, and restoration returning the original project identifier, metadata and existing task/comment content. A 390px recovery confirmation remained readable with scrollWidth 390; the viewport override was reset. The restored settings page was reloaded. No deletion, credential change or permission grant was performed in this browser journey.
