# Existing workspace-switcher write contract

The deployed `afe708b923` WorkspaceMenuRoot writes only `last_workspace_id` when its existing dropdown selects a workspace. Native `identity.preferences.selectWorkspace` now provides that field-level action, returning the currently authorized workspace ID/slug for navigation. It uses current live unrestricted identity and active workspace membership, preserves all other latest profile/preferences fields, increments the existing profile revision only when selection changes, and leaves full-form CAS protection intact. Repeated selection is idempotent. No legacy IUser/Profile DTO or new preference table is introduced.

Two module BDD cases cover concurrent preference preservation, canonical renamed slug, stale full-form rejection, idempotence, revoked membership and restricted-account denial. Backend TypeScript and scoped Oxc pass. No UI wiring or deployment is claimed.

The inherited dropdown's member count remains a separate missing projection. Legacy WorkSpaceViewSet counts active WorkspaceMember rows whose user is not a bot. Native workspaces.list currently exposes neither that total nor a bot classification. Do not substitute zero, a loaded-page subtotal, or a fabricated bot flag. Existing PowerK workspace navigation does not persist last workspace; changing that behavior requires its own source-backed decision.
