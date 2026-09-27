# Native onboarding

Canonical profile preference owner remains ownProfile/profileRevision/writeProfile. Explicit completion validates current selected workspace membership and the captured profile revision, merges stored preferences and returns current authorized workspace slug. Cosmetic names are not required; inherited completion simply sets the flag. No email verification or administrator roles are fabricated.

The prepared UI reuses ProfileForm, extracted existing CreateWorkspace and IncomingInvitations. Completed accounts skip onboarding. Unfinished profile edits are not reset by incoming updates; workspace selection captures revision. Same selected/requested workspace preserves the detail URL and applies current slug; selecting another workspace routes to its clean default, matching native workspace navigation. Sign-out remains available for verification/recovery. Existing creation/invitation progress flags are preserved, not inferred.

Behavioral tests cover preference preservation, stale revision, revoked membership and current renamed slug. Frontend route tests cover same-workspace detail preservation and clearing incompatible details on explicit workspace switch. No forced gate is mounted until reviewed backend deployment.
