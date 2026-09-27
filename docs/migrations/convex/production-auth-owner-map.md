# Preserved production authentication boundary

The deployed `afe708` auth-root, form-root, email, password, unique-code and auth-header files match the checkout. The forgot-password popover differs. This change does not replace production routes or presentation.

## Existing owners and remaining cutover contracts

- `account/auth-forms/auth-root.tsx` consumes instance password/magic flags, OAuth configuration, invitation query parameters and error-code redirects. Its form owner calls Django email-check, whose `existing` and `CREDENTIAL`/`MAGIC_CODE` response selects both account mode and next step. Native availability does not implement this discovery contract; no account-enumeration endpoint was invented.
- `password.tsx` and `unique-code.tsx` own CSRF retrieval and native POST redirects, including `next_path`. Password signup also owns confirmation and strength validation. Sharing those components directly with Convex would retain competing transport owners.
- `auth-header.tsx` reads a Django invitation and renders its workspace/logo. Native token-based invitations need an explicitly authorized corresponding journey before this consumer can move.
- `hooks/oauth/core.tsx` navigates Django provider endpoints with `next_path`; native OAuth uses Convex Auth actions and configured provider IDs. Destination and deep-link preservation must be integrated with the authenticated production bootstrap, not replaced by a fabricated instance DTO.

Only the container/header base are currently pure presentation. Extracting them alone would create cosmetic churn without resolving these contracts. Production components remain unchanged.

## Useful native consumer correction

`convex-core/auth-policy.ts` consumes the generated availability result. Password signup/signin, password reset and email verification require their canonical capabilities; magic code requires its own capability, independent of password reset. `SignIn` uses that owner for both visible inputs and submission, while configured OAuth remains available. Pending policy shows loading and a settled empty configuration shows no available methods. Revocation of a method while a flow is open removes that form and preserves other configured entry points.

Requires backend `662be8f961` or a descendant before using the updated native QA sign-in. There is no compatibility fallback. Frozen 3030 and production auth are untouched. No deployment or browser acceptance is claimed in this commit.

Verification: two behavior tests exercise password-flow revocation and magic-only operation; native web TS7 and scoped Oxc pass. Tests run in the existing convex-core test glob. Browser acceptance must cover password, magic-only, OAuth-only and disabled-method states after coordinated backend activation; no real email delivery is implied.

## Password-entry reuse follow-up

Production `AuthPasswordForm` now consumes `PasswordFields`, extracted from its existing field markup without changing its classes, labels, visibility controls, focus-driven strength/matching feedback, or forgot-password slot. The native QA signup consumes the same component and `newPasswordError`, which delegates to the existing `getPasswordStrength`. No password regex or strength vocabulary was duplicated. Sign-in remains able to use existing weaker credentials; native reset is outside this signup slice. Signup confirmation is also checked at submission, including keyboard submission.

The account-entry owner is independent of transport. Django retains CSRF and native POST; Convex retains its auth action, availability checks and verification transitions. The native server's existing 8–1024 length policy is not represented as equivalent to the stricter inherited signup UX. No server security-policy change is included.

Deletion/reuse receipt: existing production visibility/focus state and password field markup moved to the account feature owner; native signup's generic password input was replaced, not supplemented. Other production reset/set-password consumers remain unchanged. The two current consumers justify the component; there is no generic transport adapter, instance DTO, or idle callback seam.

Classic complexity: production AuthPasswordForm 36→14, new PasswordFields18, validation3. Native SignIn36→37 and submit14→17 retain the existing seven-flow QA choreography; this is a narrow existing-owner exception, not a claimed global simplification. Cognitive assessment: password-entry owner is clear; native flow orchestration remains a separate simplification opportunity. Two additional behavioral tests cover matching/weak signup inputs through the production-used validation owner. Scoped Oxc and native web TS7 pass. Rendered production and native signup acceptance remains root-owned and unverified at this source checkpoint.

The native sign-in now mounts the existing `TranslationProvider` around its form. Production already receives it from `AppProvider`; native `CoreProvider` does not. This reuses canonical initialization/readiness and avoids relying on a previously visited legacy route or global import timing for translated labels. No legacy store or instance provider was added. The two signup tests are included by the routine convex-core test glob.

Primary Chrome follow-up after `5d43aa4448`: local3021 rendered the shared signup's translated Set a password / Confirm password labels. Show password changed the first field to text; Hide password restored masking. Desktop and390×844 screenshots showed the fields and actions without clipping; the viewport was reset. No new credentials were entered and no account was created. This checks shared field rendering/control behavior in native QA; a complete production signup submission, real email/OAuth flows and disabled-provider browser variants remain unverified. The separately recorded password sign-in succeeded against locally activated backend2d2374e776.
