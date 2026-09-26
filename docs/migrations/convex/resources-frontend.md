# Native Resources vertical slice

## Owner and contract

Legacy owners are `apps/api/plane/summon/models/collaboration.py:ResourceLink`, its serializer/viewset, and `apps/web/core/components/summon/resources/resources-root.tsx`. Native ownership is `apps/convex/convex/resources/index.ts`, consumed through generated API types by `apps/web/core/components/convex-core/resources/`.

The new directory uses reactive bounded pagination and explicitly filters loaded rows. Selecting a row stores its durable ID in the URL; the detail query normalizes that raw string, verifies the selected workspace and every linked project/document/client, and provides current write permission and association names. The displayed detail never uses a stale directory object. Guest project membership disables editing even for workspace members. Private linked documents remain private. A local boundary contains removed/unauthorized detail errors and offers navigation back.

Create/edit uses current generated IDs from authorized project/document/client directories. The canonical current association is retained when beyond the first option page; raw unknown strings are never cast into IDs. Edit captures its baseline and detects reactive external changes. Mutation CAS requires `expectedUpdatedAt`, and update timestamps advance monotonically, preventing concurrent writes within one millisecond from sharing a revision marker.

URLs are canonical HTTP(S) URLs without embedded credentials, maximum 2048 characters. Title/category are trimmed. Description has a native 10,000-character budget; legacy Django TextField had no explicit length bound, so this is a deliberate native limit. Credentials remain a separate unported domain; no credential secret enters this form. Existing resource remove remains a soft deletion. Legacy resource widgets, credentials, file references, and external service actions are not migrated by this link directory.

## Design evidence

Inspected references:

- [Retool resources](https://mobbin.com/screens/6938d60e-93ac-4124-ac31-a406300f17af): compact resource rows, subordinate type, clear creation action.
- [Twingate resources](https://mobbin.com/screens/64d6a88f-ecfc-443f-9070-5177e76a7cb7): identity/address columns with edit actions subordinate to resource navigation.

| Existing / alternate structure                                                                               | Decision                                                                      | Acceptance                                        |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| Legacy directory has category widgets, credentials sidebar and utility icons beyond native link capabilities | One compact link directory with loaded-row search and explicit pagination     | Only available capabilities are presented         |
| Direct external navigation mixed with editing                                                                | Directory opens internal detail; external anchor appears separately in detail | Selecting a resource never leaves the product     |
| Editing a directory snapshot                                                                                 | Canonical reactive detail and version-checked edit                            | Remote edits cannot silently overwrite newer data |
| Dense wide association row                                                                                   | Three columns desktop, stacked narrow                                         | Names and URL wrap without clipping at 390px      |

## Verification

- Backend resource suite: 9 tests, including private document isolation, guest/write distinction, revoked access, raw deep-link normalization, stale edit rejection, unsafe/userinfo URLs, description limit, create/update/remove and cross-workspace rejection.
- Full backend suite at this slice: 168 tests passed. Backend native TypeScript and Oxlint passed.
- Frontend module tests: 3 scenarios cover current association beyond the first page, rejection of unknown raw IDs, and no duplicate option after later pagination. Native web TypeScript, focused Oxlint and Oxfmt passed.
- Actual Chrome at `http://127.0.0.1:3010/core?workspace=northstar-convex-qa&module=resources`: created `QA Delivery Reference` with Northstar Release project, Delivery collaboration verified document and Northstar QA Client; saved title/description edits, read back all three associations; deleted the synthetic QA resource and verified reactive directory removal. Its deep link then rendered the local unavailable boundary: resource ID `mh7b4z5hasb4rvsxnqzrbzmzgn8f42qz`.
- Desktop detail and constrained 390×844 detail screenshots inspected. URL, long title, description and associations wrapped; measured document scroll width equaled viewport 390. Temporary viewport override reset. No linked external resource was visited.

Permission revocation is backend-tested; actual Chrome covered removal-driven boundary recovery, not a second-user revocation session. Browser evidence is local development runtime, not a deployed production build.
