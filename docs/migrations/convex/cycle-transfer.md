# Completed-cycle unfinished transfer

The registered inherited TransferCycleIssueEndpoint calls `transfer_cycle_issues`: capture source statistics then move backlog/unstarted/started tasks while completed/cancelled tasks stay. The inherited cycle action only offers this on completed cycles. Native transfer preserves that boundary rather than weakening ordinary `requireOpenCycle` assignment.

## Resumable owner

Begin captures immutable source counts and distributions plus candidate task/membership identities and task revisions. It checks source cap100 using take101, source/destination metadata CAS, same project, current writer roles and destination open lifecycle. Only one running transfer per source is allowed. The captured snapshot includes all active source tasks, while only unfinished tasks become candidates. Numeric estimate sums are labelled separately from category/nonnumeric estimates; status, assignee and label distributions retain their original values. No historical burndown is fabricated. Snapshot size above512KiB rejects explicitly.

Each explicit continuation moves at most20 tasks, using canonical taskChanged activity/notification delivery. This is a static fanout bound (existing100 subscribers per task), not a measured capacity claim. The destination's100-task membership capacity is checked before each atomic batch. Current roles/lifecycle, captured task revision and original membership are rechecked. A changed task blocks the whole next batch until the user explicitly skips changed candidates. Skip records its reason; cancel leaves already moved tasks in the destination and pending candidates in their current location. Completion is recorded only when no pending entries remain. Initial statistics never mutate as the job progresses.

Snapshots are project-writer-only because native guests can have task-specific read restrictions. Blocker titles additionally require current task project identity and active state; missing, inactive or foreign-project references expose no title. Job revisions prevent concurrent continuation/skip/cancel decisions from overwriting each other.

## Verification

Five BDD journeys cover21-task partial progress, completed/cancelled retention, immutable numeric estimates and taxonomy snapshots, changed-task blocking and explicit skip, cancellation after partial movement, valid81-task destination-capacity fixture, lifecycle pause, guest denial, source overflow and foreign-task title redaction. Native backend/web TypeScript and scoped Oxc pass. Classic complexity maximum13; begin7 and step5. Browser acceptance and deployment are pending at this receipt revision.

The UI prepares a snapshot, then requires explicit batch continuation. It shows moved/skipped/pending separately and explains skip/cancel consequences. History and candidate lists are paginated, and large snapshot distributions progressively reveal50 rows. No globally complete live analytics, legacy burndown parity or rollback of earlier batches is claimed.
