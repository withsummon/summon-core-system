# Atomic preserved profile onboarding step

The inherited profile step combines names, display name, timezone, optional
marketing consent and the profile_complete onboarding flag. Native
identity.profile.completeProfile uses the same validation/write owner as
profile.save and writes those values under one captured profile revision.
It marks only profileComplete, preserving workspace flags, preferences and
isOnboarded. Concurrent edits fail without replacing the user's captured draft.

Marketing consent remains an optional field on the existing private profile.
Absence grants no permission; this effective false is not an imported historical
choice. The source Profile model defaults false. Explicit opt-in/opt-out is
persisted; omission preserves the prior choice. Self-hosted production UI hides
this control, so its request must omit consent. No separate consent table or
independent revision was introduced. Existing profile.save can carry an explicit
consent choice without completing onboarding.

Four focused profile/consent tests and native TS7 passed. They cover atomic step
completion, consent CAS, opt-out, omitted-choice preservation and unauthenticated
writes. Touched Oxc and formatting passed. No backend deployment, production UI
activation or real profile/consent mutation was performed. Avatar upload revision
handoff is a separate producer being implemented by the frontend owner.
