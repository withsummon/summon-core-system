# Personal workspace quick links

## Existing owner and native contract

Legacy `app/urls/workspace.py` registers list/create at `/api/workspaces/{slug}/quick-links/` and get/patch/delete at `.../{id}/`. `app/views/workspace/quick_link.py` limits all operations to the requesting owner and current workspace membership, including guests. Workspace administrators do not inherit access to other owners. `db/models/workspace.py:WorkspaceUserLink` stores nullable/blank title, URL, opaque JSON metadata and owner, newest-first. `app/serializers/workspace.py:WorkspaceUserLinkSerializer` prefixes scheme-less URLs with HTTP and rejects duplicate exact URL strings for one workspace/owner. Metadata has no fixed object shape.

Native `quickLinks/index.ts` owns list/get/create/update/remove; schema indexes owner/workspace/deleted state and owner/workspace/deleted state/URL. Duplicate validation is transactional and indexed; no collection-wide count or cap. Public functions derive caller identity via requireWorkspace without its writer restriction, preserving guest ownership. Partial update omission preserves existing title/URL/metadata. URL spelling is preserved after legacy prefix/trim handling; it is not canonicalized with URL.href. URL hostname grammar was traced against Django URLValidator in the existing local benchmark container. The platform URL parser validates IPv6 only. No URL is fetched by these functions.

Metadata retains JSON objects, arrays and scalar values. Top-level null is rejected like the non-null JSONField, while nested null is accepted. Convex-only bytes, bigint, nonfinite numbers and non-JSON objects are rejected. There is no extra metadata size cap; Convex document/value limits apply. The open-shaped schema validator is deliberate storage compatibility with JSONField, not a parallel client metadata DTO.

## Concurrency, deletion and compatibility

Native mutation contracts add exact updatedAt CAS and monotonic revisions. List uses the existing 1–100 row/1MB server-owned page budget and newest-first index ordering; metadata edits do not change creation order. remove performs **soft deletion**. There is no normal restore endpoint or recovery UI, matching the currently traced legacy surface; do not describe removal as user-recoverable. Deleted records release URL uniqueness and disappear from ordinary reads.

REST compatibility remains unimplemented: Convex uses generated IDs/workspace IDs and a paginated envelope rather than Django UUID/slug paths and list-array responses. No legacy routes are removed or redirected. The native sidebar omits metadata during edits so it remains preserved. get remains for the existing detail contract; an unused raw-ID resolver was removed.

## Verification and review

Module-owned tests exercise metadata roundtrip/omission, nullable title, HTTP prefix, exact duplicate rejection, deletion/recreation, guest CRUD, administrator isolation, membership revocation, CAS under a frozen clock, stable pagination and malformed URL/non-JSON input rejection. Native types, focused lint/complexity and formatting are required gates. Deployment and browser verification belong to the coordinated checkpoint, not this backend receipt.

Schema changes are one table import/spread plus generated module discovery. No dependency, global identity-policy, existing task lifecycle or legacy-source changes are needed. Parent independently sampled ownership, indexes, revisions and serializer parity; no blocking findings reported before final URL-shape checks.
