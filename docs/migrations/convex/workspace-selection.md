# Existing workspace-switcher write contract

The deployed `afe708b923` WorkspaceMenuRoot writes only `last_workspace_id` when its existing dropdown selects a workspace. Native `identity.preferences.selectWorkspace` now provides that field-level action, returning the currently authorized workspace ID/slug for navigation. It uses current live unrestricted identity and active workspace membership, preserves all other latest profile/preferences fields, increments the existing profile revision only when selection changes, and leaves full-form CAS protection intact. Repeated selection is idempotent. No legacy IUser/Profile DTO or new preference table is introduced.

Two module BDD cases cover concurrent preference preservation, canonical renamed slug, stale full-form rejection, idempotence, revoked membership and restricted-account denial. Backend TypeScript and scoped Oxc pass. No UI wiring or deployment is claimed.

The inherited dropdown's member count remains a separate missing projection. Legacy WorkSpaceViewSet counts active WorkspaceMember rows whose user is not a bot. Native workspaces.list currently exposes neither that total nor a bot classification. Do not substitute zero, a loaded-page subtotal, or a fabricated bot flag. Existing PowerK workspace navigation does not persist last workspace; changing that behavior requires its own source-backed decision.

## Current native member count

`workspaces.member_count.page` now exposes authorized active-membership contributions using the existing workspace index and page budget (1–50 rows). It excludes inactive membership and nonexistent users, emits one contribution even for sparse zero-count pages, and never labels that contribution a total. The production dropdown must follow all cursors and display a sum only after exhaustion; reactive updates must recompute from current page results rather than accumulating previous counts. Pending/invalidated pages require loading state, not zero.

Production native account creation is currently the canonical Password, verified email and OAuth auth owner; no bot/service-account creation or imported bot classification exists. This count is exact for that supported human-native model, not a claim that inherited bot/import parity is complete. Adding a future service-account/import owner requires explicit classification at that owner before claiming the inherited nonbot total. No parallel aggregate table or guessed bot flag was created.

A module BDD traverses five one-row pages containing inactive memberships, verifies the completed sum and denies anonymous/revoked readers. Backend TypeScript and scoped Oxc pass. Endpoint deployment and production dropdown integration remain pending.
