import type { AuthProviderConfig } from "@convex-dev/auth/server";
import { oauthConfigurations, providerNames } from "./config";
type OAuthProvider = Extract<AuthProviderConfig, { type: "oauth" | "oidc" }>;
type Profile = Record<string, unknown>;
function object(value: unknown): Profile {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("OAuth profile unavailable.");
  return value as Profile;
}
async function read(url: string, accessToken: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("OAuth identity could not be verified.");
  return response.json();
}
export function verifiedProfile(profile: Profile) {
  if (profile.emailVerified !== true || typeof profile.email !== "string" || !profile.email.includes("@"))
    throw new Error("A verified provider email is required.");
  const id = profile.id;
  if ((typeof id !== "string" && typeof id !== "number") || String(id).length === 0)
    throw new Error("OAuth identity unavailable.");
  return {
    id: String(id),
    email: profile.email.trim().toLowerCase(),
    emailVerified: true,
    name: typeof profile.name === "string" ? profile.name : undefined,
  };
}
export function oauthProviders(env: Record<string, string | undefined>): OAuthProvider[] {
  return oauthConfigurations(env).map((configuration): OAuthProvider => {
    const { id, clientId, clientSecret, host, organization } = configuration;
    const endpoints =
      id === "google"
        ? {
            authorize: "https://accounts.google.com/o/oauth2/v2/auth",
            token: "https://oauth2.googleapis.com/token",
            user: "https://www.googleapis.com/oauth2/v2/userinfo",
            scope: "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
          }
        : id === "github"
          ? {
              authorize: "https://github.com/login/oauth/authorize",
              token: "https://github.com/login/oauth/access_token",
              user: "https://api.github.com/user",
              scope: `read:user user:email${organization ? " read:org" : ""}`,
            }
          : id === "gitlab"
            ? {
                authorize: `${host}/oauth/authorize`,
                token: `${host}/oauth/token`,
                user: `${host}/api/v4/user`,
                scope: "read_user",
              }
            : {
                authorize: `${host}/login/oauth/authorize`,
                token: `${host}/login/oauth/access_token`,
                user: `${host}/api/v1/user`,
                scope: "email profile read:user",
              };
    return {
      id,
      name: providerNames[id],
      type: "oauth",
      clientId,
      clientSecret,
      checks: ["state", "pkce"],
      allowDangerousEmailAccountLinking: false,
      client: { token_endpoint_auth_method: "client_secret_post" },
      authorization: { url: endpoints.authorize, params: { scope: endpoints.scope } },
      token: endpoints.token,
      userinfo: {
        url: endpoints.user,
        async request({ tokens }: { tokens: { access_token?: string } }) {
          if (!tokens.access_token) throw new Error("OAuth access token unavailable.");
          const profile = object(await read(endpoints.user, tokens.access_token));
          if (id === "google") return { ...profile, emailVerified: profile.verified_email === true };
          if (id === "gitlab")
            return {
              ...profile,
              emailVerified: typeof profile.confirmed_at === "string" && profile.confirmed_at.length > 0,
            };
          const data = await read(
            id === "github" ? "https://api.github.com/user/emails" : `${host}/api/v1/user/emails`,
            tokens.access_token
          );
          if (!Array.isArray(data)) throw new Error("Verified provider email unavailable.");
          const emails = data.map(object);
          const email =
            emails.find((row) => row.primary === true && row.verified === true) ??
            (id === "gitea" ? emails.find((row) => row.verified === true) : undefined);
          if (!email) throw new Error("A verified provider email is required.");
          if (organization) {
            if (typeof profile.login !== "string") throw new Error("OAuth membership unavailable.");
            const membership = object(
              await read(
                `https://api.github.com/orgs/${encodeURIComponent(organization)}/memberships/${encodeURIComponent(profile.login)}`,
                tokens.access_token
              )
            );
            if (membership.state !== "active") throw new Error("OAuth organization membership required.");
          }
          return { ...profile, email: email.email, emailVerified: true };
        },
      },
      profile: verifiedProfile,
    };
  });
}
