import type { AuthProviderConfig } from "@convex-dev/auth/server";
import type { GenericOAuthConfig } from "better-auth/plugins";
import { z } from "zod";
import { oauthConfigurations, providerNames } from "./config";

type OAuthProvider = Extract<AuthProviderConfig, { type: "oauth" | "oidc" }>;
type Configuration = ReturnType<typeof oauthConfigurations>[number];
const identityFields = {
  id: z.union([z.string().min(1), z.number().finite()]).transform(String),
  name: z
    .string()
    .nullish()
    .transform((name) => name ?? undefined),
};
const email = z
  .string()
  .email()
  .transform((value) => value.toLowerCase());
const verifiedIdentity = z.object({ ...identityFields, email, emailVerified: z.literal(true) });
const googleIdentity = z.object({ ...identityFields, email, verified_email: z.literal(true) });
const gitlabIdentity = z.object({ ...identityFields, email, confirmed_at: z.string().min(1) });
const providerIdentity = z.object({ ...identityFields, login: z.string().optional() });
const providerEmails = z.array(z.object({ email, primary: z.boolean().optional(), verified: z.boolean() }));
const membership = z.object({ state: z.literal("active") });
async function read(url: string, accessToken: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("OAuth identity could not be verified.");
  return response.json();
}
function endpoints(configuration: Configuration) {
  const { id } = configuration;
  const host = "host" in configuration ? configuration.host : undefined;
  const organization = "organization" in configuration ? configuration.organization : undefined;
  return id === "google"
    ? {
        authorize: "https://accounts.google.com/o/oauth2/v2/auth",
        token: "https://oauth2.googleapis.com/token",
        user: "https://www.googleapis.com/oauth2/v2/userinfo",
        scopes: ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
      }
    : id === "github"
      ? {
          authorize: "https://github.com/login/oauth/authorize",
          token: "https://github.com/login/oauth/access_token",
          user: "https://api.github.com/user",
          scopes: ["read:user", "user:email", ...(organization ? ["read:org"] : [])],
        }
      : id === "gitlab"
        ? {
            authorize: `${host}/oauth/authorize`,
            token: `${host}/oauth/token`,
            user: `${host}/api/v4/user`,
            scopes: ["read_user"],
          }
        : {
            authorize: `${host}/login/oauth/authorize`,
            token: `${host}/login/oauth/access_token`,
            user: `${host}/api/v1/user`,
            scopes: ["email", "profile", "read:user"],
          };
}
async function providerUser(configuration: Configuration, accessToken?: string) {
  if (!accessToken) throw new Error("OAuth access token unavailable.");
  const { id } = configuration;
  const host = "host" in configuration ? configuration.host : undefined;
  const organization = "organization" in configuration ? configuration.organization : undefined;
  const rawProfile = await read(endpoints(configuration).user, accessToken);
  if (id === "google") {
    const { verified_email, ...profile } = googleIdentity.parse(rawProfile);
    return { ...profile, emailVerified: verified_email };
  }
  if (id === "gitlab") {
    const { id: subject, email: address, name } = gitlabIdentity.parse(rawProfile);
    return { id: subject, email: address, name, emailVerified: true };
  }
  const profile = providerIdentity.parse(rawProfile);
  const emails = providerEmails.parse(
    await read(id === "github" ? "https://api.github.com/user/emails" : `${host}/api/v1/user/emails`, accessToken)
  );
  const verifiedEmail =
    emails.find((row) => row.primary === true && row.verified === true) ??
    (id === "gitea" ? emails.find((row) => row.verified === true) : undefined);
  if (!verifiedEmail) throw new Error("A verified provider email is required.");
  if (organization) {
    if (!profile.login) throw new Error("OAuth membership unavailable.");
    membership.parse(
      await read(
        `https://api.github.com/orgs/${encodeURIComponent(organization)}/memberships/${encodeURIComponent(profile.login)}`,
        accessToken
      )
    );
  }
  return { id: profile.id, name: profile.name, email: verifiedEmail.email, emailVerified: true };
}
export function nativeOAuthProviders(configurations: Configuration[]): GenericOAuthConfig[] {
  return configurations.map((configuration) => {
    const urls = endpoints(configuration);
    return {
      providerId: configuration.id,
      clientId: configuration.clientId,
      clientSecret: configuration.clientSecret,
      authorizationUrl: urls.authorize,
      tokenUrl: urls.token,
      scopes: urls.scopes,
      pkce: true,
      authentication: "post",
      getUserInfo: (tokens) => providerUser(configuration, tokens.accessToken),
    };
  });
}

// Retained only for restoring the pre-cutover Convex Auth deployment. Remove
// after verified credentials are imported and native sign-in is accepted.
export function oauthProviders(env: Record<string, string | undefined>): OAuthProvider[] {
  return oauthConfigurations(env).map((configuration): OAuthProvider => {
    const urls = endpoints(configuration);
    return {
      id: configuration.id,
      name: providerNames[configuration.id],
      type: "oauth",
      clientId: configuration.clientId,
      clientSecret: configuration.clientSecret,
      checks: ["state", "pkce"],
      allowDangerousEmailAccountLinking: false,
      client: { token_endpoint_auth_method: "client_secret_post" },
      authorization: { url: urls.authorize, params: { scope: urls.scopes.join(" ") } },
      token: urls.token,
      userinfo: {
        url: urls.user,
        request: ({ tokens }: { tokens: { access_token?: string } }) =>
          providerUser(configuration, tokens.access_token),
      },
      profile: (profile) => verifiedIdentity.parse(profile),
    };
  });
}
