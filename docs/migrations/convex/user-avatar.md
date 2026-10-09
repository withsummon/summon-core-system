# Personal avatar assets

## Inherited contract and owner

`UserAssetsV2Endpoint` accepts USER_AVATAR for the authenticated asset owner. Publication clears the older external avatar value, soft-deletes the prior asset, and sets `user.avatar_asset_id`; removal clears that pointer. Native external/provider avatar URLs remain a separate unsupported consumer contract; this slice never fetches arbitrary image URLs.

`userAppearance` owns exactly one avatar pointer per user. It is separate storage for the pointer, not a separate version owner: every publication, removal and recovery atomically advances the existing `userProfiles.revision`. A concurrent profile/preferences edit invalidates an outstanding upload or confirmation. Existing profile forms retain their captured revision and draft on conflict.

## Shared asset boundary

The stored asset workspace may be null only for `userAvatar`. Ordinary public upload fields still require a workspace. The central asset scope owner rejects non-avatar null-workspace and mixed avatar/project/document/task/draft/conversation scopes. User ID comes from the stored avatar intent; caller-supplied read context never changes ownership or write authority.

Self access works with no workspace membership. Another user's descriptor requires an explicit currently shared workspace. The authenticated download path carries that nonsecret workspace context; every byte read rechecks session and both memberships using indexed lookups. No membership scan, public storage URL or credential-bearing URL is introduced. Existing asset purposes retain their own authorization and do not gain permission from the context.

Preparation and finalization reuse asset policy, SHA256/size/signature validation, upload cancellation, expiry cleanup and authenticated HTTP. Replacement soft-removes prior bytes for seven-day recovery. Generic asset removal cannot bypass profile revision checks. The canonical shared image reader retains abort/revoke behavior.

## Evidence and pending acceptance

Three new BDD journeys cover no-workspace lifecycle, duplicate finalize, profile revision advancement, stale competing upload, shared-workspace read, absent/wrong context, both membership revocations after descriptor read, foreign writes, mixed-purpose scope, ordinary null-workspace rejection and expired recovery. Full backend: 578 tests across 92 files pass. Native backend/web TypeScript passes; scoped Oxc has no warnings. Classic new-owner complexity is at most 14 (avatar scope); pointer replacement and recovery are 8.

UI is mounted in Account details, using existing upload/image controls. Backend commit `f4d10b339d` plus test-directive correction `1178393b69` passed exact archive TS7 and deployed locally (`http://127.0.0.1:3210`); log `/tmp/summon-migration-control/avatar-local-deploy.txt`. Frontend native TS7 and scoped Oxc pass. Chrome acceptance is parent-owned and pending at this checkpoint. No remote deployment occurred. User cover image and directory-wide avatar presentation remain separate parity work.

## Chrome runtime acceptance — 2026-09-27

Fixed frontend `4d461b740f3503da73659300ac73a53c33c785c9`, artifact tree SHA256 `9186730e2b173958d8bd54a8a68fd71eed237a80e201033198c3a533c7819c54`, served at `http://127.0.0.1:3028/core`, uses temporary gateway3218 to the same backend HTTP actions. Fresh sign-in loaded the existing QA avatar with complete 192×192 decoded pixels. Recovering the original QA avatar replaced it and decoded another complete 192×192 image without reload. Removal restored the account's original no-avatar state; both files remain recoverable. Earlier upload/replacement mutations and stale profile-save conflict were verified, but their image requests exposed the site-proxy deadlock. This gateway check resolves that local image-rendering failure; it does not establish remote ingress acceptance or capacity. See `local-jwt-site-proxy.md` for the rejected JWT experiment and compatible OIDC restoration.
