# Personal workspace quick links

## Traced contract and implementation

Legacy owners are the home widget `home/widgets/links/{root,create-update-link-modal,link-detail}.tsx`, `workspace.service.ts`, `QuickLinkViewSet`, and `WorkspaceUserLink`. The product contract is personal links scoped to a workspace, including guests; optional titles; an opaque metadata value; and navigation opening in a new tab. Administrators do not manage another user's links.

`convex-core/quick-links/quick-links.tsx` now renders that journey in the native workspace sidebar, lazily mounted and keyed by the selected workspace. The section has real destination anchors plus Add, Edit and Remove controls. The sidebar can scroll at desktop widths so loading additional links does not strand navigation below the viewport.

The backend is the sole URL normalization and validation owner. The form accepts explicit HTTP/HTTPS URLs or scheme-less addresses, which receive the legacy HTTP prefix. It does not add a second frontend URL parser or guessed protocol fallback. Anchors use the server-validated stored URL with `target="_blank"` and `rel="noopener noreferrer"`, and their accessible label states that they open a new tab. React renders titles as text.

Edit captures the opening link and updatedAt. It sends only title and URL, preserving opaque metadata by omission at the canonical update owner. Remove captures its confirmation revision. Conflicts retain the form/confirmation and error without silent retry. The list requests ten rows at a time, with explicit Load more and no total claim. Guest users see their own controls without an administrator role gate; authorization and owner filtering stay on the backend.

## Verification

Scoped Oxc lint passed with zero warnings/errors for the sidebar module and shell. Module-local backend quick-link journey tests passed 10 cases, including ownership, guest behavior, duplicate URLs, URL validation, metadata preservation and stale updates. Native web TypeScript 7 passed after generated API refresh. Independent backend-owner review found no concrete issue in the sampled form, row or anchor flow.

Browser QA remains primary-owned: create a scheme-less link; verify safe new-tab navigation; edit title/URL; reject duplicate or invalid destination while retaining input; two-tab stale edit; remove confirmation; separate user privacy; guest manages own link; switch workspaces; desktop and 390px layout. No browser or deployment success is claimed by these source/type/test checks.

No deployment, commit or dependency addition was performed by this frontend task. Link metadata editing, favicon/website metadata fetching, copy-to-clipboard actions, link reordering and public restore are not implemented. Removal follows the legacy public contract with no Trash/restore UI. The legacy dashboard widget remains registered while route retirement is handled separately.

## Primary local acceptance

Deployed to local Convex at 12:32:54 on 2026-09-27. Primary root behavior suite passed 285 backend tests /33 files and 19 frontend tests; full native type gate passed30 tasks. No remote deployment claim.

Chrome created a scheme-less local reference and verified its stored HTTP href and actual new-tab authenticated destination. Another owner tab edited the title to Delivery workspace reference; the original stale edit was rejected while Stale personal link draft remained visible in its form. Guest could not see that link, then created Guest delivery reference; the administrator's personal list did not expose the guest link. Duplicate and malformed-hostname submissions displayed errors and retained entered values.

The 390-pixel form, validation text and controls were visually inspected with document scrollWidth390. Temporary viewport emulation was reset and the unsaved invalid form was cancelled. Removal, metadata preservation and membership revocation are covered by server behavior tests; removal was not exercised in Chrome because this slice has soft deletion without a normal recovery UI. No exhaustive browser or legacy REST parity claim is made.
