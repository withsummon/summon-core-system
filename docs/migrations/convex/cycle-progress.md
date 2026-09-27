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
numeric/category estimates, and foreign label name redaction. Focused progress + transfer verification: 17 tests pass, native backend and web
TypeScript 7 checks pass, scoped Oxc passes. No deployment or browser acceptance
is claimed by these source checks.

The frontend sums loaded page contributions and explicitly marks partial
coverage until exhaustion. The existing transfer distribution presentation is
shared with current progress. Empty sparse pages still expose Load more. Two
module-local frontend tests cover bucket merging and reactive replacement without
mutating source contributions. Backend71517a97e5 was deployed from an immutable
archive to local3210; exact archive TypeScript7 passed. Remote deployment and
browser acceptance remain separate. Reactive pages can update independently; this is a
current live view, not a globally atomic historical report. No fabricated burndown,
completion chart, REST alias, point-weighted historical series, or legacy snapshot
selection parity is included. Those inherited routes remain live.

## Numeric closure and frontend gate

Correction `3606a8081d` accepts finite signed/scientific decimal estimate values
in the same shared calculation, matching the inherited FloatField cast grammar
without JavaScript hexadecimal coercion. Eight public-query cases cover signed,
scientific, fractional, whitespace, hexadecimal and non-finite values. Previously
captured transfer snapshots are unchanged. The immutable archive passed native
TypeScript7 and deployed locally; raw log is
`/tmp/summon-migration-control/cycle-progress-3606a8081d-local-deploy.txt`.

The mounted cycle UI passes native web TypeScript7, scoped Oxc, and two aggregation
behavior tests. Independent frontend source review sampled query pagination,
partial coverage, cycle-key remount and shared distribution rendering without a
blocking finding. Browser acceptance is pending the primary agent; neither remote
deployment nor visual quality is established by these gates. Scoped commits used
manual gates with hooks disabled under the active migration workflow.
