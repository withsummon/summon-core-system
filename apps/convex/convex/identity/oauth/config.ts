import { z } from "zod/v4";
import { convexToZod } from "convex-helpers/server/zod4";
import { v } from "convex/values";
import { encryptedFields } from "../../mcp/schema";

export const oauthProviderIds = ["google", "github", "gitlab", "gitea"] as const;
export const providerNames = { google: "Google", github: "GitHub", gitlab: "GitLab", gitea: "Gitea" } as const;
const host = z.string().transform((value, ctx) => {
  const url = URL.canParse(value) ? new URL(value) : null;
  if (
    !url ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    ctx.issues.push({ code: "custom", message: "Enter an HTTPS provider origin.", input: value });
    return z.NEVER;
  }
  return url.origin;
});
const clientId = z.string().trim().min(1).max(8192);
const clientSecret = z.string().min(1).max(8192);
const fields = { clientId, clientSecret, sync: z.boolean() };
export const oauthConfiguration = z.discriminatedUnion("id", [
  z.object({ ...fields, id: z.literal("google") }),
  z.object({
    ...fields,
    id: z.literal("github"),
    organization: z
      .string()
      .regex(/^[a-zA-Z0-9-]+$/)
      .optional(),
  }),
  z.object({ ...fields, id: z.literal("gitlab"), host }),
  z.object({ ...fields, id: z.literal("gitea"), host }),
]);
const [google, github, gitlab, gitea] = oauthConfiguration.options;
const encryptedSecret = { clientSecret: convexToZod(v.object(encryptedFields)) };
export const storedOAuthConfiguration = z.discriminatedUnion("id", [
  google.extend(encryptedSecret),
  github.extend(encryptedSecret),
  gitlab.extend(encryptedSecret),
  gitea.extend(encryptedSecret),
]);
export const oauthSettings = z.array(storedOAuthConfiguration).max(oauthProviderIds.length);
// Operator environment is a real unsafe initialization boundary. Initialized
// instances never reconstruct environment variables from stored settings.
export function oauthConfigurations(env: Record<string, string | undefined>) {
  return oauthProviderIds.flatMap((id) => {
    const prefix = id.toUpperCase();
    const parsed = oauthConfiguration.safeParse({
      id,
      clientId: env[`${prefix}_CLIENT_ID`],
      clientSecret: env[`${prefix}_CLIENT_SECRET`],
      host: id === "gitlab" ? (env.GITLAB_HOST ?? "https://gitlab.com") : env.GITEA_HOST,
      organization: env.GITHUB_ORGANIZATION_ID || undefined,
      sync: env[`ENABLE_${prefix}_SYNC`] === "1",
    });
    return parsed.success ? [parsed.data] : [];
  });
}
