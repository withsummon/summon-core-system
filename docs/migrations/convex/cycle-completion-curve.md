# Cycle completion curve (D16)

## Actual inherited contract

`CycleAnalyticsEndpoint` (`app/views/cycle/base.py:786`) returns `completion_chart` from `analytics_plot.burndown_plot`. It subtracts current members' current completion timestamps from current membership totals (or current point values), for each inclusive cycle date. Future dates are null. Reopening clears completion; re-completion replaces its timestamp. This is not historical membership or estimate event replay. Transfer captures a frozen chart in `progress_snapshot`.

## Native owner

`cycles.burndown.page` reads 1–20 indexed memberships per page, applies canonical current task/workspace/project visibility, and returns one sparse contribution even for an empty authorized page. Contributions contain cycle dates/timezone, requested clock's calendar day, total count/numeric points/unquantified estimates and daily completion buckets. A consumer must finish every page before presenting a total. For each inclusive cycle date, remaining is the total minus all completion buckets through that date (including pre-start completions); dates after `asOfDay` are null. Null start/end means unscheduled, not a fabricated chart. Sparse buckets avoid allocating an unbounded date range.

Date conversion reuses the cycle calendar owner; numeric estimates reuse the existing progress owner extracted as `numericTaskEstimate`. This deliberately follows native cycle timezone and current authorized visibility rather than reproducing inherited server-timezone/guest information leakage. Numeric category values are not silently treated as points. Paginated current data remains reactive; it is not a transactionally frozen cross-page historical report.

New transfer snapshots capture the same sparse curve before moving memberships, within the existing 100-task/512 KiB bounds. `burndown.frozen` uses the existing writer-only transfer access convention. Old snapshots return explicit `unavailable`; their old totals cannot reconstruct daily completions. No fabricated backfill, event bus or historical membership store was added.

## Verification and limits

Module behavior tests cover timezone/DST day conversion, pre-start completions, reopening, retained frozen values, changed numeric/category estimates, current guest visibility/revocation and old-snapshot unavailability. Existing transfer and current-progress tests are included in focused verification. No deployment or frontend chart activation is claimed. UI composition and actual browser acceptance remain pending. This closes a backend data owner, not full rendered burndown parity or genuine historical scope analysis.

Public transfer wiring verification extends the existing transfer scenario: begin captures 23 tasks and two points, real bounded transfer steps move tasks, a changed task is explicitly skipped, then public task completion and estimate-point update mutations leave the persisted curve unchanged. All five transfer behavior cases pass.

Product integration must preserve the existing Plane/Summon screen. The inherited consumer chain is `CycleService.workspaceActiveCyclesAnalytics` → `CycleStore.fetchActiveCycleAnalytics` → `CycleAnalyticsProgress`/`SidebarChart` → `ProgressChart`/Propel AreaChart. Detail/archive distributions and active-cycle productivity are additional consumers. Native aggregate contributions must be adapted at that data boundary after all pages complete; no simplified `/core` chart is mounted or accepted as its replacement. A prepared QA-only composition remains uncommitted. Existing chart null-to-zero handling and single-day ideal-line division require a focused chart-data fix during integration; they are not fixed by the backend owner.
