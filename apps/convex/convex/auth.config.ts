import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";

const convexSiteUrl = process.env.CONVEX_SITE_URL;
if (!convexSiteUrl) throw new Error("CONVEX_SITE_URL is required for Convex Auth.");

export const betterAuthEnabled = process.env.SUMMON_AUTH_ENGINE === "better-auth";
export default {
  providers: betterAuthEnabled
    ? [getAuthConfigProvider({ basePath: "/api/better-auth" })]
    : [{ domain: convexSiteUrl, applicationID: "convex" }],
} satisfies AuthConfig;
