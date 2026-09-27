# Personal stickies

## Production owner and contract

Legacy `plane/app/views/workspace/sticky.py` restricts querysets to workspace and owner. Workspace admins, members and guests may create/list; creator decorators and the owner-filtered queryset govern edits/removal. `plane/db/models/sticky.py` owns nullable name, JSON/HTML/binary/stripped content, logo properties, foreground/background colors and floating sort order. The app serializer in `app/serializers/workspace.py` sanitizes HTML and validates supplied binary. Actual `components/stickies/sticky/inputs.tsx` writes HTML through the existing sticky editor; it does not derive its visible document from opaque JSON/binary fields. BaseModel inherits the soft-delete mixin.

Native `stickies/index.ts` is the sole persistence owner. All calls require current active workspace membership and exact owner identity, including guests. Workspace administrators cannot read, edit, remove or restore another owner's sticky. The workspace argument is checked against the persisted row. Ownership and workspace cannot be updated.

Public functions: list(workspaceId, deleted, query, paginationOpts), get(workspaceId, stickyId), resolve(workspaceId, raw stickyId), create(workspaceId, optional fields), update(workspaceId, stickyId, expectedUpdatedAt, optional fields), reorder(workspaceId, stickyId, expectedUpdatedAt, sortOrder), remove and restore with the same captured revision. Get includes the owner's Trash item; edits/reorders reject deleted items. Removal is soft deletion, and native Trash restoration retains content, appearance and order. No purge is exposed.

## Content, appearance and ordering

HTML uses the canonical `tasks/rich_content.ts` sanitizer/parser. Safe formatting is retained; scripts, event attributes and unsupported markup are removed. Search matches derived plain text, case-insensitively, rather than raw HTML or the optional name, matching the app's description_stripped search boundary. JSON and binary are independently preserved opaque legacy content fields, not trusted rendering or a new collaborative merge protocol. A partial HTML update does not overwrite omitted JSON/binary/appearance. The native UI must render sanitized HTML and must not hydrate an editor from unvalidated opaque binary/JSON. Inline images, mentions and other excluded editor extensions remain separate parity work.

Bounds: HTML and JSON 100,000 characters each, binary 512 KiB, nullable name 10,000 characters, logo JSON 10,000 characters, nullable colors 255 characters, search 1,000 characters. JSON values reject non-JSON Convex values and non-finite numbers. These are explicit native limits, not claimed inherited capacity. Empty/default HTML is `<p></p>`; name/colors/binary default null and JSON/logo default empty objects. Appearance strings retain original values, including legacy palette keys; the existing UI palette should map these to approved presentation rather than concatenate arbitrary markup.

Active list order is descending persisted sortOrder with Convex's index tie-breaking. Reorder accepts finite numbers within the safe numeric range and uses the captured row revision. New notes use the current owner's highest active order plus 10,000, starting at 65,535. This intentionally avoids legacy's workspace-wide max allocation, which exposed other owners' activity through numeric gaps. It preserves each owner's visible ordering without scanning all notes or imposing a collection count cap. Trash is ordered by deletion time and then the remaining index keys; restoration reuses the stored order. Equal order values are valid and repeat deterministically. Every write advances updatedAt monotonically, including a frozen clock.

Lists read at most 100 candidate rows/1 MiB and preserve sparse-page continuation after search. No total count is claimed. Reordering while paging changes the live ordering; consumers must refresh a traversal if they need a single stable sequence. This is a reactive list, not an atomic report snapshot.

## Remaining boundaries

Legacy app ordering is `-sort_order`; PAT `api/views/sticky.py` deliberately lists by `-created_at`. The registered PAT DRF router and app REST paths remain, with their UUID/slugs, method/envelope and permission contracts. Native RPC does not replace those wire boundaries. Native HTML policy is the existing task editor subset, not the full inherited sticky editor/upload/mention policy. Binary byte preservation does not establish Yjs validity or HTML/JSON/binary equivalence. No legacy rows were imported and no endpoint was retired.

## Verification

Six module BDD scenarios cover guest owner CRUD, admin isolation, revoked membership, sanitized HTML/derived search, JSON/binary/appearance roundtrip and omission preservation, persisted ordering/ties/sparse cursors, stale same-clock writes, Trash recovery, cross-workspace denial and payload/page bounds. Native scoped lint/complexity and formatting pass. Shared full type/test gates and actual browser/deployment evidence are reported separately by the coordinating owner because concurrent task ACL work is in flight. This receipt does not claim live deployment.
