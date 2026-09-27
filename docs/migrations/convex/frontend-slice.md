# First web slice

The candidate route is `/core`. Existing routes remain under `legacy-layout.tsx`
and its Django-backed `AppProvider`. The root document still owns fonts, theme,
and global layout. `/core` owns a separate Convex authentication/subscription tree.

## Owner receipt

- Identity and authorization: Convex Auth and the backend membership checks.
- Public boundary: generated `@summon/convex/api`, with result types derived using
  `FunctionReturnType`. No hand-written entity DTOs or branded-ID casts.
- Selection: URL workspace slug and project identifier resolve against authorized
  query results. URL strings are never converted into trusted database IDs.
- Write visibility: membership roles returned by the list owners. Mutations still
  enforce authorization; hiding controls is not a permission boundary.
- Task status feedback: Convex paginated optimistic update. The SDK owns rollback
  when a mutation fails. Task creation waits for server acceptance.
- Presentation: existing Propel Button/Input and SummonField with existing design
  tokens. The legacy task root requires Django/MobX owners and is not imported.

## Current verification

`pnpm --filter web check:types` passes with TypeScript 7. Focused Oxlint reports
zero warnings/errors. Oxfmt passes all nine touched frontend files. Classic
cyclomatic complexity is at most 10 on the new route/module files.

Browser acceptance is owned by the main migration run. Required cases are real
password signup/login, create workspace/project/task, second-client update,
status rejection rollback, guest read-only controls, membership revocation,
signout, deep-link refresh, and the existing Django route after provider movement.
No browser success or route-latency advantage is claimed by this source-level
receipt. Backend behavioral tests live under each backend module's `__tests__`.

## Scope remaining

This slice does not replace legacy task filters, assignments, dates, attachments,
project states, or documents. Django and its database must remain until those
contracts and other module journeys have a verified replacement.

## Membership and route dependency follow-up

Account details exposes the signed-in user's ID. Authorized administrators use
explicit-ID lookup to obtain a server-validated identity before calling the
generated grant/revoke mutations. Workspace and project access remain separate.
No raw user-entered string is cast to a database ID.

The root document no longer imports the utilities barrel for a static class list.
The existing error UI is loaded lazily only when an error occurs. The Core title
uses router navigation so it does not reload the document. These are dependency
and navigation changes; browser measurements must establish their latency impact.

The web workspace has Node pure-function tests but no React testing setup. No
new test dependency was introduced. Backend module behavioral tests and the main
run's real Chrome journeys verify this slice; rendered frontend acceptance is
not claimed by these source checks.

## Compact workspace scrolling correction

Chrome at 390px showed the fixed-height shell keeping its tall workspace sidebar above a separately scrolling content region, leaving too little editing area. The shared native shell now scrolls as one column below the desktop breakpoint; desktop retains independently scrolling content. The header does not shrink. Resource editing and meeting summary controls were rendered at 390px with the workspace selector scrolled away and no horizontal overflow. Native web types and focused shell lint pass. No navigation or permission policy changed.
