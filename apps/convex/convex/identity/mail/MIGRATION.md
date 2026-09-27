# Password reset and email verification

The backend and module-local tests are active in the checkout. No configuration or real email delivery was changed. Backend and patch checkpoint c3a7b4133e was deployed to both hosts by the primary agent before activating the conditional SignIn form.

## Canonical owner and patch

Convex Auth0.0.95 Password owns password hashing, accounts, reset and verification flow. Email owns code authorization; canonical authVerificationCodes owns hashed tokens, expiry and one-time consumption. No custom credentials store, crypto or private \_handler invocation is introduced. Installed source and official Context7 `/get-convex/convex-auth` password/email documentation were inspected.

The narrowly version-pinned `patches/@convex-dev__auth@0.0.95.patch` changes src and shipped dist for two owners. Password reset returns the same null accepted result for known, unknown and mail-failed requests. Operational failures log only the fixed diagnostic `Password reset request could not be completed.` No recipient/token/provider response is logged. This prevents response-content enumeration; timing resistance is not claimed. Canonical createVerificationCode applies existing authRateLimits token-bucket logic under a SHA256 recipient mail-issuance namespace, separate from login failures, with three sends/hour shared across reset/verification. Rejection occurs before token replacement and rolls back atomically, preserving the most recent usable code. It does not add IP-level10/minute ingress protection from the inherited Django throttle; that infrastructure gate remains explicit.

Patch registration uses supported pnpm patch/patch-commit with exact version and no dependency version change. Existing package license retained. Remove the patch only when a tested upstream release provides equivalent reset response privacy and issuance throttling; retain behavior tests during upgrade. Existing unrelated lock/package dirt must remain untouched. `patch-owned-lock.diff` contains only the four relevant lock hunks, regenerated after each patch update.

## Delivery and availability

Inspected key presence only in repo .env, apps/api/.env and apps/convex/.env.local: none of inspected SMTP/Resend keys were configured. This is not a claim about remote environment configuration. Existing native package dependencies provide no SMTP transport. Optional Resend delivery uses platform fetch, no added SDK. Required AUTH_RESEND_KEY, EMAIL_FROM and SITE_URL must be present and valid; availability publishes booleans/reason only, never configuration values. The sender uses a fixed HTTPS endpoint, rejects redirects, applies15s timeout, and sends plain-text codes with15min expiry rather than accepting caller redirect URLs. Convex Auth retains default32-character random tokens. Deliverability/verified sender domain are unverified.

Auth configuration keeps current Password behavior when mail is unavailable; with configured mail it registers reset and verification providers. Enabling verification intentionally requires unverified account sign-ins to verify email. SignIn uses the availability contract; no enabled reset form exists when unavailable. Known/unknown reset messages remain identical. Verification requires same email and code, reset verification also requires a new password. Existing auth library rotates the credentials and invalidates prior sessions; shared live-session enforcement makes those revocations immediate at native authorization owners.

## Evidence and remaining delivery gates

Six module-local convex-test journeys pass against the actual installed patched distribution with a mocked HTTP sender: accepted-response privacy including sender failure; valid reset changing actual canonical password and revoking old sessions; invalid/replayed/expired codes; signup email verification; missing-provider configuration; and throttle rejection preserving the live code. No real recipients, real API keys or email service were used. The test override composes the public convexAuth/Password APIs and only substitutes its ordinary auth module loader; it does not call private handlers.

The tests live in identity/mail/**tests**. The conditional SignIn form is active and passes native web TS7 and focused Oxc lint; rendered acceptance is tracked separately by the primary agent. Real delivery, production mail configuration, frontend rendered acceptance, timing resistance and IP-level ingress throttling remain separate gates. Legacy SMTP routes remain available; no claim of full authentication retirement.

## Ingress throttle boundary

The inherited `apps/api/plane/authentication/rate_limit.py` AuthenticationThrottle is an anonymous-request IP limiter (default 10/minute), distinct from email issuance. Native auth.signIn is a Convex action: its public ActionCtx has no trusted HTTP request/IP. Browser-supplied IP fields would be forgeable and are not accepted. The checked-in Caddy CE proxy forwards /auth/\* to Django, contains no native Convex authentication limiter, and its broad TRUSTED_PROXIES default must not be treated as verified client-IP provenance. A trusted deployment ingress owner covering direct Convex auth action requests must enforce and test the IP rule before that parity gate can close. No remote ingress configuration or protection is claimed from repository inspection.

### Activation receipt, 2026-09-27

Backend `c3a7b4133e` deployed to both self-hosted hosts. Both live availability
queries returned passwordReset=false and emailVerification=false with the
unconfigured-delivery reason. Chrome on the inherited native stickies entry at
port3021 showed the ordinary sign-in fields and explicit reset-unavailable text,
without a reset form. This verifies the disabled configuration state only.
Root independently ran all six mocked delivery tests. Global TS7 passed30/30;
no real mail or credential changes were performed through Chrome.

## Magic-code sign-in and signup

The inherited owner is app/magic.py → MagicCodeProvider → Redis ten-minute token → shared account adapter. Native `summon-magic` registers the existing Email provider only when the same delivery configuration is available. It shares the sender and hashed recipient issuance budget with reset/verification; ten-minute expiry, random 32-character token, same entered email plus code, canonical verification and session creation remain Convex Auth owners. Known and new requests have the same public started response. A new user can sign up by proving email ownership; an existing verified account links through the existing canonical email owner. This does not automatically take over an unverified Password identity.

Two additional mocked BDD cover existing verified user reuse, new verified identity creation, identical request outcomes, wrong-email denial, replay/expiry and shared cross-purpose issuance throttling. No real email was sent. Canonical incorrect-code throttling uses the existing email-keyed default ten failures/hour token bucket, not the inherited five attempts per issued Redis code. Exact per-code-five invalidation/reset and IP ingress throttling remain explicit parity gaps; neither is described as implemented. The matching backend checkpoint af588be807 was deployed to both hosts by the primary agent before activating the conditional magic form. Native web TS7 and scoped Oxc pass; rendered unconfigured-state acceptance is owned by the primary agent.

## Explicit delivery scope decision

On 2026-09-27 the user selected **Resend only**. SMTP transport/configuration migration is deliberately excluded; it is no longer an inherited-parity blocker and no SMTP dependency will be added. Existing `mail/config.ts` and `mail/provider.ts` remain the only account-email configuration and sender owners.

Remote availability was rechecked after that decision: passwordReset=false, magicCode=false, emailVerification=false; account email delivery is unconfigured. Operator handoff requires setting AUTH_RESEND_KEY (secret Resend sending key), EMAIL_FROM (sender authorized for the Resend verified domain), and SITE_URL (actual native frontend origin) in the remote Convex deployment environment. Do not place credentials in chat, source control or browser query parameters. No configured availability claim proves successful delivery. First-user registration/verification and instance bootstrap remain pending; valvaltrizt@gmail.com currently has no remote account, and no verification flag or password was fabricated.
