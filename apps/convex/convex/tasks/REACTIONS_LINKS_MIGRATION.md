# Task reactions and external links

## Legacy trace

`app/views/issue/reaction.py` permits project admin/member/guest reaction creation and actor-only deletion by reaction code. `IssueReaction` has active-row uniqueness on issue/actor/reaction; deleted rows are retained by the shared soft-delete owner. The actual issue reaction UI converts Unicode code points to decimal strings joined with `-` (not hexadecimal). Lists are newest-created. The serializer accepts arbitrary text; native input is deliberately constrained to at most 32 valid, non-control Unicode scalar code points in this established decimal encoding, normalized before uniqueness checks. This is not an exhaustive emoji catalog.

`app/views/issue/link.py` uses ProjectEntityPermission: active project readers may list and members/admins may create/update/delete, regardless of who created a link. `IssueLinkSerializer` prefixes absent schemes with HTTP, validates URLs and rejects duplicate active URLs per issue, excluding the current row during updates. Title is nullable/255 characters, metadata is JSON. List order is newest-created. There is no task-link reorder field or endpoint. Create/update also enqueue `work_item_link_task.py` to crawl metadata/title using pinned URL/DNS safeguards; that worker is a separate remaining contract.

## Native owners

`tasks/reactions.ts` exposes access(taskId), list(taskId,paginationOpts), and set(taskId,reaction,active). Set derives actor from current authentication, never from the request. Repeated desired state is idempotent and does not touch task revision or emit an event. Addition/removal changes only the caller's active row; removal tombstones it, and re-addition creates a new newest row. Lists return bounded individual actor rows with current actorName and isMine, not a misleading page-local global count.

`tasks/links.ts` exposes access(taskId), list(taskId,deleted,paginationOpts), get(taskId,linkId), create(taskId,url,title?,metadata?), update(taskId,linkId,expectedUpdatedAt,url?,title?,metadata?), and lifecycle(taskId,linkId,expectedUpdatedAt,deleted). Link removal is recoverable soft deletion. Restore rejects a URL that has since been reused. Deleted-link list/detail are restricted to current project writers; guest readers cannot inspect removed metadata through recovery queries. Current writers can edit/remove/restore links created by another writer, matching the inherited write boundary. Immutable task and creation actor are retained; partial changes preserve omitted metadata/title/URL.

Both reuse canonical `requireTask`: current workspace/project membership and the project's guest-view policy govern reads; archived tasks are readable but reactions and link writes require active tasks; deleted and triage tasks are rejected. Reactions allow any caller who can currently read the active task. Link writes additionally call the canonical project writer owner, which denies guests. No duplicated guest visibility predicate or administrator bypass was introduced.

Successful changes use `taskChanged` for monotonic task revision and the canonical recipient-event transaction. Link metadata/lifecycle revisions are also monotonic and reject stale forms. Events currently use generic `updated`, not the full legacy link/reaction before/after activity payload or specialized email wording. Failed validation/CAS and duplicate desired reaction state leave revision/activity unchanged.

URL/title/JSON validation reuses `quickLinks/validation.ts`; link metadata adds an explicit 10,000-character bound. URLs preserve validated spelling, have the existing 2048-character bound and HTTP/HTTPS policy, and are never fetched by this slice. Link/reaction lists read at most 100 candidates/1 MiB. No collection count cap or full-count projection is added. External links are distinct from resource records and from task graph relationships.

## Remaining contracts

Comment reactions, public board votes/reactions, PAT/app REST aliases, legacy arbitrary reaction text/import compatibility, aggregate reaction counts/actor tooltips across all pages, metadata crawling/previews, detailed activity/notification payloads and link-specific editor integrations remain. Browser anchors must use the canonical URL with safe new-tab relation attributes; backend creation does not authorize an external request. Existing Django controllers remain registered. This is a bounded native domain slice, not retirement approval.

## Verification

Seven module BDD scenarios cover actor uniqueness/idempotence/isolation, canonical guest-policy changes, archive/revocation read/write behavior, invalid Unicode/page bounds, writer-versus-reader link permissions, immutable attribution and task scope, URL uniqueness on create/update/restore, frozen-clock CAS, preserved metadata and task deletion read denial. Native TS7 and scoped Oxc pass. Independent owner review and browser/deployment acceptance are separate gates; no live deployment is claimed here.
