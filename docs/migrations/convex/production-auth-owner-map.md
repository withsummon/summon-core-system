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
