# Credential vault and MCP frontend slice

## Product boundary and owner

The native Credentials module keeps the existing vault's credential identity, metadata, access, and activity journeys. It uses Convex generated contracts directly and mounts lazily from the workspace navigation. Detail selection uses a shareable `credential` parameter resolved and authorized by the backend, independently of loaded pagination. Access loss stays inside the credential module and preserves workspace navigation.

The credential owner controls encryption, permissions, remote scope, revision checks, password verification, single-use operation proofs, and audit records. The UI neither receives ciphertext through metadata queries nor persists revealed plaintext. Metadata forms capture their opening revision; conflicts retain their draft. The module does not import Django services or stores.

## Experience selection

The established credential list/detail layout was retained because it keeps the current credential and account visible while switching between metadata, requests, grants, and audit. A single long page with all controls would obscure the sensitive operation being approved. Detail sections therefore expose one workflow at a time, with creation and metadata editing using existing Summon fields and controls.

Inspected references:

- [1Password credential detail and reveal](https://mobbin.com/screens/14659580-9475-4d6c-8c8b-8e2dbd6e163b): persistent credential identity and separate deliberate secret disclosure. Adapted to a temporary reveal dialog rather than an oversized character display.
- [Lyssna password confirmation](https://mobbin.com/screens/5696ab15-e90c-4fb7-80a6-90bd00f5fdbd): focused password confirmation with the consequential operation named on the action. Applied through the repository's existing Dialog primitive.

| Existing requirement | Composition decision | Acceptance condition |
| --- | --- | --- |
| Find a scoped credential and inspect its metadata | Credential rail plus canonical detail, account and status beside identity | Reload preserves selection; mobile width does not overflow |
| Perform a sensitive operation deliberately | Password dialog names reveal, rotate, revoke, or delete | Wrong password causes no operation; plaintext clears on close, tab hiding, or 30 seconds |
| Grant explicit access | Dedicated Access section with member, permission, and expiration | Use-only grantee can request operations but cannot reveal the secret |
| Review MCP consequences | Canonical preview lists scoped JSON, read/write classification, and separate approval | Preview and cancel make no external call; unavailable execution is disabled |

## Supported behavior

- Create and edit credential metadata, including paired native and remote project scope; list and canonical detail are live subscriptions.
- Grant/revoke member permissions and inspect the paginated audit log. View means permission to reveal; use does not include reveal. Backend role and grant checks remain authoritative.
- Reveal, rotate, revoke, and delete through actual password verification followed by a single-use operation proof. Revealed plaintext remains component-local, is not copied automatically, and is hidden on dialog dismissal, tab hiding, or 30 seconds. Delete is irreversible and its confirmation says so.
- Build MCP previews using server-owned tool capabilities; inspect scope-injected arguments and read/write classification. Explicit execution is a separate action. Canonical persisted status/result owns feedback; unknown external-write results are not retried automatically.
- An unconfigured MCP endpoint still allows preview/cancel. Execution is disabled and the missing configuration is shown accurately.

## Verification and remaining scope

Native web typecheck and focused Oxlint passed on the initial implementation. Backend behavioral tests cover authorization, real password-provider verification, session-bound proof ownership, and invocation lifecycle. Browser acceptance is a separate pending gate. QA uses synthetic credentials only; no real secret or external MCP invocation is required or claimed.

This is a bounded vault migration. Legacy arbitrary credential providers, attachments, notes, global search, and broad credential grouping are not implemented by this slice. Remote endpoints are configured by the operator, not entered as arbitrary browser URLs. Real external tool execution remains unverified until an authorized configured endpoint is exercised.

## Local Chrome acceptance (2026-09-27)

Created a synthetic, non-functional MCP secret in the local QA workspace. Wrong-password reveal was rejected; the existing QA account password revealed the exact synthetic value, which was then hidden. The audit showed denial, verification and reveal without credential plaintext. A scoped MCP preview was created and cancelled; execution was disabled because no endpoint is configured. A separate peer session could neither list nor open the credential. The 390px layout had no horizontal overflow. No real credential was rotated/deleted and no external MCP request was sent. Grant changes, sensitive-operation deletion/rotation and timeout hiding have backend or source evidence only, not browser acceptance here.
