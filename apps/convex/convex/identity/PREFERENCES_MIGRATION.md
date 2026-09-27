# Private profile preferences and onboarding

## Owner and inherited contract

Legacy `plane/db/models/user.py:Profile`, `app/serializers/user.py:ProfileSerializer`, and `app/views/user/base.py:ProfileEndpoint` own current-user profile metadata. `user` is read-only; GET/PATCH select the authenticated user. Dedicated onboarding/tour endpoints update self-declared UX flags. Frontend `core/store/user/profile.store.ts`, AuthenticationWrapper and StoreWrapper consume these fields. Completing onboarding does not prove membership or grant authorization.

Native `identity.profile.get` reads personal fields and preferences. `identity.preferences.save({ expectedRevision, preferences })` uses the same private profile owner and revision as `identity.profile.save`; concurrent preference and name edits conflict rather than silently overwrite. No user ID input or administrator bypass exists. Public `users.name` remains owned by profile.save and preference writes do not alter it.

Preserved defaults: empty theme, language en, Sunday week start (0), docked app rail, smooth cursor off, full notification view, four false desktop onboarding steps, incomplete onboarding/tours, null use case/job role/last workspace. Theme supports current named themes and hexadecimal 3/6-digit custom colors; arbitrary legacy JSON theme extensions are intentionally not accepted. Language preserves a nonempty string up to 255 characters; this does not claim that every language has a renderer. Week start is an integer 0–6. Job role is at most 300 characters; use case has an explicit 20,000-character native bound. Selecting last workspace requires current membership; legacy accepted a raw UUID, so this is an intentional authorization tightening.

## Stored-data transition

Existing profiles may omit `preferences` temporarily. `profile.get` returns the exact default preferences for those rows. All new profile rows persist defaults. Internal `identity.migrations.preferences({cursor})` reads at most 100 rows/1 MiB per page, fills only missing preferences, and reports processed/changed/isDone/continueCursor. Filling the already-observed default does not increment profile revision. Explicit values are never overwritten.

Removal condition: parent records complete backfill and zero-change second scans on both local and remote deployments, then makes preferences required and removes this compatibility read and migration entrypoint. No deployment or backfill was run by this slice.

## Verification and remaining scope

Eleven profile/preferences behavior tests pass, including private defaults, cross-surface CAS, anonymous access, membership revocation, onboarding without authority, invalid-value atomicity, and convergent backfill preserving saved values. Native TypeScript 7 and scoped Oxlint/format pass. No browser or deployed runtime claim is made.

Frontend preference controls and inherited profile REST aliases are not switched here. Billing/company/goals/mobile/avatar/marketing-consent metadata and credentials/email/provider/account lifecycle remain separate parity work. Theme and onboarding flags are stored correctly but do not themselves wire the inherited application bootstrap to Convex.
