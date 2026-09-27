# Preserved onboarding step ownership

Source baseline: `afe708b92370542e09dd065454337e3c83c08604`.
The active `onboarding/root.tsx` and `steps/workspace/create.tsx` differ from the unused older `onboarding/create-workspace.tsx`: team creation records `workspace_create` before the invite screen; solo creation and incoming invitation joins finish without fabricating create/join flags. `workspace_invite` records completion of the invite screen, including **Skip**, not successful email delivery.

`identity.onboarding.completePreserved` uses the same completion/profile revision owner as the existing QA endpoint. It requires profile completion and current workspace membership, returns the current slug, and preserves other preferences. An explicit invitation-step completion requires recorded creation for the selected workspace. No invitation-delivery fact is inferred.

`workspaces.create.onboardingRevision` is opt-in for the preserved journey. Workspace insertion, initial admin membership, last-workspace selection and the actual team-creation flag commit together; a stale profile revision rolls all of them back. Ordinary workspace creation remains unchanged. Organization size is validated by the existing settings owner. The initiating session remains valid when a password is set during profile onboarding; other sessions are revoked by the installed canonical auth package patch.

The existing `identity.onboarding.complete` retains its old profile/join flag behavior solely for the currently mounted `/core` QA onboarding consumer. Remove that endpoint when that consumer is retired or migrated; production preserved entry uses `completePreserved`.

Verification: six public onboarding behavior tests cover QA compatibility, profile prerequisite, incoming join without invented flags, solo and team creation, skipped invitation-step completion, stale revision rollback and revoked membership. Password setup/session behavior is covered separately in ten password tests. No live onboarding, email delivery or credential mutation is claimed by these tests.

Invitation presentation also receives the canonical acceptance batch maximum from `invitations.availability`. Send/resend results return the exact issued revision used for delivery, so retry targets that invitation with CAS rather than discovering a newer revision. A concurrent rotation leaves the receipt stale intentionally.
