# Avatar upload acknowledgement for preserved onboarding

The inherited `ProfileSetupStep` opens `UserImageUploadModal`, uploads immediately, and changes the form's avatar URL before submitting the remaining profile fields. Native avatar publication already advances the shared profile revision. The preserved native form therefore needs the revision produced by its own upload, rather than reading a newer profile revision and accidentally accepting another writer's changes.

`publishAvatar` records `avatarPublishedRevision` on the asset in the same transaction as the appearance pointer and profile write. `identity.avatar_upload.finalize` checks own-user scope, reuses `assets.upload.finalize` for claims, MIME/bytes validation and publication, and returns the private stored starting/committed revision pair. Retry returns the original pair; no latest-profile lookup or arithmetic acknowledgement is used. The generic finalizer still returns the asset ID.

The optional receipt is intentional: ordinary assets have no profile publication and historical avatar uploads have no recorded acknowledgement. Missing receipts are rejected, not inferred or backfilled. A frontend may advance its captured form revision only when the returned starting revision matches that captured revision. `profile.completeProfile` then atomically saves names, optional consent and onboarding completion through the existing profile owner. Any subsequent writer still invalidates its CAS.

Focused behavioral coverage exercises immediate upload then profile completion, repeated finalization, a later independent profile write followed by rejected stale completion, and another user's denial. No route is activated by this prerequisite; the preserved entry family remains unmounted pending complete transport and browser acceptance.

Immediate removal returns the revision from the same `replaceAvatar` transaction. The preserved form applies the identical captured-starting-revision check; existing callers may ignore this additive result. The avatar journey test verifies the returned revision against the ensuing canonical profile state.
