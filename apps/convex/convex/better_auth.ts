import { createClient, type AuthFunctions, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins";
import { ConvexError } from "convex/values";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalQuery, type MutationCtx } from "./_generated/server";
import authConfig from "./auth.config";
import { requireUnrestrictedAccount } from "./identity/deactivation/access";
import { sendAccountEmail } from "./identity/mail/sender";
import { requireSignup } from "./identity/signup_policy";

export const siteUrl = process.env.SITE_URL ?? "";

const authFunctions: AuthFunctions = internal.better_auth;
export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, user) => {
        await requireSignup(ctx, user.email);
        if (user.emailVerified) await linkVerifiedUser(ctx, user._id, user.email, user.name);
      },
      onUpdate: async (ctx, user) => {
        if (user.emailVerified) await linkVerifiedUser(ctx, user._id, user.email, user.name);
      },
      onDelete: async (ctx, user) => {
        const link = await ctx.db
          .query("betterAuthLinks")
          .withIndex("by_auth_id", (q) => q.eq("authId", user._id))
          .unique();
        if (link) await ctx.db.delete(link._id);
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const sessionUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    return user ? { id: user._id, email: user.email, emailVerified: user.emailVerified } : null;
  },
});

async function linkVerifiedUser(ctx: MutationCtx, authId: string, email: string, name: string) {
  const link = await ctx.db
    .query("betterAuthLinks")
    .withIndex("by_auth_id", (q) => q.eq("authId", authId))
    .unique();
  if (link) {
    const owner = await ctx.db.get(link.userId);
    if (!owner || owner.email !== email) throw new ConvexError("Account email changes are unavailable.");
    return;
  }
  const matches = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .filter((q) => q.neq(q.field("emailVerificationTime"), undefined))
    .take(2);
  if (matches.length > 1) throw new ConvexError("Email identity is ambiguous.");
  let userId = matches[0]?._id;
  if (userId) await requireUnrestrictedAccount(ctx, userId);
  else
    userId = await ctx.db.insert("users", {
      email,
      name,
      emailVerificationTime: Date.now(),
    });
  const existing = await ctx.db
    .query("betterAuthLinks")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (existing) throw new ConvexError("This account is already linked.");
  await ctx.db.insert("betterAuthLinks", { authId, userId });
}

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    basePath: "/api/better-auth",
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
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
      emailOTP({
        overrideDefaultEmailVerification: true,
        disableSignUp: true,
        expiresIn: 600,
        allowedAttempts: 5,
        storeOTP: "encrypted",
        async sendVerificationOTP({ email, otp, type }) {
          const purpose =
            type === "sign-in"
              ? "Sign in"
              : type === "email-verification"
                ? "Verify your email"
                : type === "forget-password"
                  ? "Reset your password"
                  : "Change your email";
          await sendAccountEmail(
            email,
            `${purpose} · Summon Core`,
            `${purpose} code: ${otp}\nThis code expires in 10 minutes.`
          );
        },
      }),
    ],
  });
