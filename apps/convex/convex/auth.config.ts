import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import type { AuthConfig } from "convex/server";
import type { BetterAuthOptions } from "better-auth/minimal";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { apiKey } from "@better-auth/api-key";

const convexSiteUrl = process.env.CONVEX_SITE_URL;
if (!convexSiteUrl) throw new Error("CONVEX_SITE_URL is required for Convex Auth.");

export const betterAuthEnabled = process.env.SUMMON_AUTH_ENGINE === "better-auth";
const authConfig = {
  providers: betterAuthEnabled ? [getAuthConfigProvider()] : [{ domain: convexSiteUrl, applicationID: "convex" }],
} satisfies AuthConfig;

export default authConfig;

export const siteUrl = process.env.SITE_URL ?? "";

// Static options own the native database schema and are shared by the runtime.
export const authOptions = {
  baseURL: process.env.CONVEX_SITE_URL,
  trustedOrigins: [siteUrl],
  rateLimit: { enabled: true, storage: "database", customRules: { "/convex/jwks": false } },
  session: { freshAge: 300 },
  user: { deleteUser: { enabled: true } },
  // Public unlink is disabled; the canonical disconnect mutation owns the live method floor.
  account: { accountLinking: { allowUnlinkingAll: true } },
  disabledPaths: [
    "/delete-user",
    "/delete-user/callback",
    "/unlink-account",
    "/change-password",
    "/verify-password",
    "/update-user",
    "/api-key/create",
    "/api-key/list",
    "/api-key/get",
    "/api-key/update",
    "/api-key/delete",
  ],
  emailAndPassword: {
    // Native verification serves the current administrator exception; issuer hooks own policy.
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 1024,
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: { sendOnSignUp: true, sendOnSignIn: true },
  plugins: [
    crossDomain({ siteUrl }),
    convex({ authConfig }),
    apiKey({
      defaultPrefix: "plane_api_",
      requireName: true,
      maximumNameLength: 255,
      enableMetadata: true,
      keyExpiration: { minExpiresIn: 0, maxExpiresIn: Infinity },
      rateLimit: { timeWindow: 60_000, maxRequests: 60 },
    }),
  ],
} satisfies BetterAuthOptions;
