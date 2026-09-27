# OAuth identity providers

## Canonical owner and boundary

Convex Auth 0.0.95 owns authorization state, PKCE, token exchange, callback verification codes, account IDs, account linking and session issuance. `auth.ts` registers only fully configured native providers. `http.ts` already mounts the canonical auth HTTP routes. No parallel credentials/token table, private library imports, package additions or callback handlers are introduced. Official Convex Auth documentation was checked through Context7 and matched against the installed callback and users owners.

Inherited adapters are `apps/api/plane/authentication/provider/oauth/{google,github,gitlab,gitea}.py`; the inherited shared adapter selects the existing user by normalized email. Native providers require verified email and link only to an existing uniquely verified email under the canonical Convex Auth owner. They do not attach an OAuth account to an unverified Password identity. This deliberately narrower policy avoids claiming an existing unverified account; users may have distinct identities until a separately authorized linking workflow exists. Existing provider account IDs remain authoritative on repeat login. There is no manual linking/unlinking UI in this slice.

## Provider proof and configuration

- Google uses its inherited userinfo email/profile scopes and requires `verified_email === true`.
- GitHub always fetches email records and requires primary plus verified. When `GITHUB_ORGANIZATION_ID` is set, it also requires active membership in that organization, using the authenticated provider login. Configuration rejects path syntax in the organization name.
- GitLab requires a nonempty `confirmed_at`. Its configured `GITLAB_HOST` defaults to https://gitlab.com.
- Gitea requires a primary verified email or another verified email, never the unverified user-record address. `GITEA_HOST` is required. It requests email/profile/read:user OAuth scopes; an unused OpenID token is not requested.

Credentials use existing server environment names `<PROVIDER>_CLIENT_ID` and `<PROVIDER>_CLIENT_SECRET`. Self-hosted provider hosts come only from deployment configuration, require HTTPS origins, and reject userinfo, query, fragment and path. Provider API requests reject redirects and use a 15-second timeout; access tokens are used only server-side. Public availability returns provider IDs and labels only. Provider token exchange itself remains the installed library owner.

Configured callbacks are `{CONVEX_SITE_URL}/api/auth/callback/{provider}` (or the library-supported CUSTOM_AUTH_SITE_URL override). Legacy Django callback URLs are different and must remain until each configured provider registration has migrated. No configuration values or secrets were copied. Checked local environment files contained no configured keys from the inspected provider list; remote provider availability is not inferred from this.

## Evidence and remaining gates

Five module-local tests exercise missing/unsafe configuration; all four verified-email gates; GitHub organization denial; redirect rejection configuration; canonical verified-to-verified account linking and unverified-account separation; and an installed HTTP OAuth flow with mocked token/profile transport, state tampering rejected before network, and replay denial. State/account tests call the registered internal store through convex-test, never a private handler. No real provider requests or credentials were used.

Native TS7 and scoped Oxc pass. Real provider authorization, registered callback reachability, deployment availability, and rendered provider buttons remain separate gates. No claim is made for provider-specific token-exchange quirks or real Gitea/GitLab server-version compatibility until a configured roundtrip passes. Convex Auth does not persist provider access/refresh tokens for unrelated integrations; this differs from legacy Account token storage and must not be mistaken for migration of third-party integration authorization. Legacy deactivated-account/bot-account policies and ingress IP throttling remain separate identity/infrastructure closure work.
