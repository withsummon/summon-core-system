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

UI is prepared for Account details, using existing upload/image controls. Deployment and Chrome acceptance are pending at this checkpoint. User cover image and directory-wide avatar presentation remain separate parity work.
