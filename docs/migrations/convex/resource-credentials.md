# Resource credential associations

## Owner and behavior

Legacy `ResourceLink.credential` and `ResourceLinkSerializer` store a workspace credential foreign key. Its serializer validates workspace ownership. The native association points to the existing `mcpCredentials` owner; it does not broaden the vault to arbitrary legacy credential providers.

New or changed non-null associations require current credential metadata access and matching workspace, through `mcp/access.ts:requireCredential`. Resource authorization remains independent of the associated credential. Paginated resources and credentials reuse `credentialMetadataAccess`, which checks current workspace/project membership, project lifecycle and owner/expiring grant. Workspace administration does not bypass the grant. A use-only grant permits metadata association; it does not grant secret reveal.

Inaccessible/deleted credential references and names are redacted to null from resource get/list/detail; `credentialUnavailable` reports that an association exists without revealing its identity. Existing resource readers retain access to the resource itself. Authorized resource writers can preserve, explicitly detach, replace (with an accessible credential), or delete the resource, even after grant revocation or credential deletion. Unchanged links do not require new credential access. This avoids stranding a resource because its optional credential became inaccessible.

Grant expiry uses the vault owner's current-time check on reevaluation. Time passing alone does not invalidate existing Convex subscriptions. Tests that expire a grant and issue a new query establish fresh-read enforcement, not immediate timed disappearance in an already displayed page. Sensitive operations still enforce fresh current access.

Resource responses carry the credential reference and, in authorized detail, its name only. No secret/ciphertext is read or returned. Credential details and sensitive operations remain in the existing vault owner with its step-up rules. Resource linking never invokes an external MCP endpoint.

## UI and stored-data transition

The resource form uses the existing paginated `mcp.credentials.list` and typed association selection owner. It retains a selected accessible credential beyond the first options page and exposes Load more credentials. An inaccessible association is preserved by default; an explicit checkbox allows detaching or replacing it rather than silently clobbering the hidden value. Detail navigates to the existing native Credentials module, preserving workspace selection and removing the resource selection. Existing resource CAS and draft behavior remain.

`credentialId` is optional in stored rows/public input because existing native resources and the previously served client predate this addition. New creates normalize omission to null; an update that omits the field preserves its prior association, while explicit null detaches it. This compatibility branch can be removed after stored rows are backfilled and pre-association clients are no longer served; do not make the field mandatory before those conditions.

## Verification and remaining limits

Five new module BDD tests cover ungranted workspace-admin isolation, use-only metadata access, expired-grant redaction, project-revocation redaction, deleted-credential redaction and resource deletion, cross-workspace link rejection, old rows, omitted-update preservation and explicit detach and frozen-clock CAS/delete revision advancement. The combined resource/MCP suite passed 40 tests; native backend/web typechecks and focused lint/format pass. Existing generic association selection tests remain the frontend pure-behavior owner.

No deployment, browser create/link/navigation or constrained-width acceptance was run for this change. Those gates require the coordinated updated backend. This closes the native MCP-vault association gap, not legacy arbitrary-provider vault parity or all resource-screen features. `endpoint-parity.md` remains the historical pre-change inventory checkpoint.

An additional optional complexity-rule inspection measured ResourceForm at 41 before this slice and 53 after (threshold 20); the repository default lint gate passes. The added branches represent unavailable-association preservation and selection states; no suppression or threshold change was introduced. A separate form composition cleanup is not included in this bounded security/contract change.

## Primary Chrome acceptance

After the coordinated local deployment at 07:40:56 on 2026-09-27, the owner linked the synthetic vault entry to an existing resource and followed its native credential-detail navigation. A separate localhost peer could still read the resource, saw only “Not accessible” for the credential, and could edit the category while preserving the hidden association. The owner's live view retained the named association. The peer then explicitly detached it; both views lost the association. The owner reattached the synthetic entry. No secret was revealed and no credential grant was expanded.

The 390px resource editor was inspected with the credential selector and save controls visible and no horizontal overflow. This is local role/UI acceptance; credential deletion, expiry and same-clock races are covered by backend tests rather than browser claims. Remote acceptance remains pending.
