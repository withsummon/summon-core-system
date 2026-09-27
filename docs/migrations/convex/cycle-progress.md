# Current cycle progress

## Owner and inherited contract

`apps/api/plane/app/views/cycle/base.py` owns `CycleProgressEndpoint` and
`CycleAnalyticsEndpoint`, registered in `apps/api/plane/app/urls/cycle.py` at
`workspaces/<slug>/projects/<project_id>/cycles/<cycle_id>/progress/` and
`.../analytics/`. Both permit current project administrators, members, and guests.
The legacy progress response has total and five state-group issue counts and
numeric estimate sums. Analytics additionally provides assignee/label distributions
and dated completion charts; completed cycles may return their stored progress
snapshot. `apps/web/core/services/cycle.service.ts` consumes those routes.

The native `cycles.progress.page` reads the canonical `cycleTasks.by_cycle` index,
then applies `taskCanRead` to active ordinary tasks in that exact cycle project and
workspace. Each request reads at most 20 memberships and 1 MiB of membership rows;
retained archived/deleted/triage tasks and foreign records do not contribute.
Guest ownership restrictions and current membership revocation apply before any
aggregation. Sparse pages retain continuation even when no visible task contributes.
The bound is per request, not a 100-task report limit. Each task's canonical
assignee and label arrays remain independently bounded by their property owner.

`transfer_snapshot.progressTotals` is the shared calculation owner for current
pages and immutable transfer snapshots. Numeric points contribute their finite
numeric value; category/missing estimates contribute to the unquantified count.
Unassigned/unlabelled tasks have explicit buckets. A task can contribute to several
assignee and label buckets; those distributions are not disjoint totals. Label
names require matching project/workspace ownership. Numeric estimate references
require matching point/project and system/project/workspace ownership. Assignee
labels reuse the shared memberLabel owner (name, email, then member suffix). Existing retained task IDs
are not an identifier-secrecy boundary. Current progress does not substitute or
rewrite historical transfer snapshots.

## Delivery and remaining contracts

Backend source and module BDD cover >100 memberships across bounded pages,
sparse guest pages, current updates, revoked access, inactive/foreign records,
numeric/category estimates, and foreign label name redaction. Focused progress + transfer verification: 9 tests pass, native backend and web
TypeScript 7 checks pass, scoped Oxc passes. No deployment or browser acceptance
is claimed by these source checks.

The frontend will sum loaded page contributions and explicitly mark partial
coverage until exhaustion. Reactive pages can update independently; this is a
current live view, not a globally atomic historical report. No fabricated burndown,
completion chart, REST alias, point-weighted historical series, or legacy snapshot
selection parity is included. Those inherited routes remain live.
