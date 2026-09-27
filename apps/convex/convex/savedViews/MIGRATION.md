# Project saved views: bounded native slice

## Production owner and completed journey

`schema.ts` owns the typed saved definition and personal favorite identity. `filters.ts` validates selected IDs/date ranges and evaluates the same stored definition used by `results.list`; clients cannot substitute query filters at the results boundary. `access.ts` owns current membership, guest visibility, owner-only edit, lock and owner/project-admin lifecycle capabilities. Public functions expose generated contracts, not hand-maintained frontend DTOs.

The native journey is create a project-shared view, reopen it, evaluate its saved filters against live canonical tasks, edit with monotonic CAS, favorite personally, soft-remove and restore. Names support 1–255 trimmed characters; descriptions support up to 10,000. Creation is allowed for current project members including guests. All views created here are project-shared, reflecting the legacy serializer's default public access=1; there is no new privacy/publication control. `isLocked` is persisted false at creation and enforced on update; there is no invented lock toggle because legacy access/is_locked fields are read-only.

## Filter and pagination contract

- Supported fields: ordinary task status, custom state, priority, assignee, label, creator, start-date range and target-date range.
- Every selected value within one field is OR/any. `match: all | any` combines nonempty field clauses. No clauses means match every otherwise authorized active task. Date ranges are inclusive civil ISO dates; absent task dates do not match an active date clause. Empty range objects are rejected; null means no date clause.
- Each field accepts at most 50 distinct values, with at most 100 referenced states/labels/users combined. States/labels must belong to this project, triage state is forbidden, and users need a recorded project membership (including inactive historical members). Stored selection metadata is projected independently of directory pagination; unavailable selected IDs remain represented with null names and can be removed. Saving validates the entire definition, so deleted taxonomy selections must be removed before saving edits.
- Results use the existing `tasks.by_project` index in newest-created order. Bounded pages read at most 100 candidate rows and 1 MiB; filters may yield empty pages with a valid continuation. There are no exact totals, page-local sorting or partial grouping claims. Results include canonical project identity for task references and the evaluated view revision.
- Saved view catalogs and favorites are independently bounded. Active catalog ordering is newest-created; trash is most-recent deletion; favorites are newest favorite insertion. These are explicit native list orders, not claimed legacy favorite-first/name ordering.

## Visibility, lifecycle and favorites

Current workspace/project membership and active project are required for every endpoint. Guest behavior treats either workspace or project guest as guest. Absent `guestViewAllFeatures` means false. Guests read only their own project views unless that flag is enabled; even an owned view still filters task results to guest-created tasks when the flag is false. View visibility never grants task access. Canonical `taskIsActive` excludes triage, deleted and archived tasks.

Only the owner edits an unlocked active view. Owner or project administrator may soft-remove/restore, including locked views. Trash metadata is restricted to those recovery roles regardless of guest view-all. Repeated lifecycle changes require fresh monotonic CAS. Favorites are unique to user/view; guest writes are rejected. Soft removal hides favorites without fanout deletion; restoration reveals retained favorites again. This recovery behavior intentionally differs from legacy deletion, which deletes favorites/recent visits. Revoked access hides retained favorites; no favorite grants access.

## Legacy evidence and remaining scope

`db/models/view.py` owns IssueView metadata/defaults and legacy derived `query`. `app/views/view/base.py` owns project/workspace CRUD, guest restrictions, lock/ownership checks and result/favorite endpoints; `app/serializers/view.py` marks access/is_locked read-only. Active frontend `store/issue/project-views/issue.store.ts` calls ordinary IssueService.getIssues with saved filter parameters, while workspace store calls `/workspaces/{slug}/issues/`. The ViewService `/views/{id}/issues/` helper has no matching registered route in the inspected checkout. Results producers are `app/views/issue/base.py` and WorkspaceViewIssuesViewSet, with `utils/filters`, `issue_filters.py`, `order_queryset.py`, `paginator.py`.

This is not full inherited saved-view parity. Workspace-wide views; nested rich-expression grammar; negative/null-membership/subscriber/cycle/module/estimate/relative-date filters; all other orderings; grouping/subgrouping and exact counts; board/calendar/spreadsheet/timeline layouts; display-property/logo/order metadata; archive versus trash distinction; private/locked legacy data import; favorite folders/order; recent visits; external REST/PAT boundaries remain staged. Existing Django routes stay registered. Unsupported fields are rejected by the typed public validator rather than accepted and ignored. No legacy views are imported or silently reduced to the supported subset.

## Evidence

Module-local `__tests__/journey.test.ts` covers live result inclusion/exclusion, all/any semantics, state/label matching and selection metadata, inclusive date ranges, foreign IDs/duplicate filters, sparse page continuation, owner/lock/CAS permissions, guest view-versus-task access, membership revocation, favorite isolation and removal/recovery. Backend gates are distinct from browser/deployment verification. No deployment or browser completion is claimed here.
