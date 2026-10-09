# Notification filters and bounded read batches

## Owner trace

Inherited `workspace-notifications/sidebar/filters/menu` offers multi-select assigned, created, and subscribed categories. Django notification list combines categories with OR, while its mark-all endpoint accepts different single-value categories and omits mention filtering. The inherited store also clears counts and marks unrelated loaded rows locally after a batch. These divergent paths are not copied into the native owner.

The native notification backend owns category matching, current task access, and the fixed cutoff for a read batch. The frontend passes selected categories and uses server results. Empty selection means all; selected categories combine with OR. Subscribed only excludes tasks created by or assigned to the current person. Current backend policy controls guest-created visibility. There is no client membership matching or fabricated global count, and empty filtered pages retain Load more.

## Scope and verification

The module now exposes assigned, created, and subscribed checkboxes, persisted as repeated `category` URL parameters. Existing inbox/archived/snoozed, mentions, unread, focused-comment navigation, and preserved composer drafts remain.

“Mark matching notifications read” starts a server-owned batch with captured view, mention filter, categories, and cutoff. Filter controls are disabled while running, and status records the original scope. Pages run sequentially until canonical `isDone`, including pages changing zero notifications. Only actual changed counts from returned pages are shown, with no total denominator. Explicit Stop aborts further scheduling and cancels the batch when its ID is known; an already in-flight mutation may finish. Unmount aborts scheduling without issuing a new cleanup mutation. Keying the notification module by workspace ensures switching workspaces disposes the old run. Server expiration/cleanup owns abandoned batches.

Native web TS7, scoped eight-file Oxlint, four module-local tests, and diff checks passed. New behavioral cases verify sparse-page continuation and stopping during an in-flight page without another mutation/progress update. Backend owner reports full 342 tests passed before additive cleanup work. Primary Chrome remains pending: category combinations, mention-filtered batch, new arrival kept unread, explicit Stop/navigation, desktop and 390px.

Email preferences and email delivery remain outside this slice. No dependency, deployment, or commit changes by this agent.

Chrome acceptance 2026-09-27: subscribed-only excluded the caller-created task; adding created-by-me restored it through OR selection. Mentions-only reduced the list to one notification. Mark matching read reported exactly one change; clearing mentions showed unrelated notifications still unread. Backend six batch tests and two frontend loop tests rerun by root passed. Multipage/new-arrival/revocation/stop behavior is BDD evidence, not this single-page Chrome fixture.
