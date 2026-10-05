import { createClient, type AuthFunctions, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { requireRunMutationCtx } from "@convex-dev/better-auth/utils";
import { apiKey } from "@better-auth/api-key";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP, genericOAuth } from "better-auth/plugins";
import type { BetterAuthRateLimitOptions, RateLimit } from "better-auth/types";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import authConfig from "./auth.config";
import authSchema from "./betterAuth/schema";
import { requireUnrestrictedAccount } from "./identity/deactivation/access";
import { deactivateAccount } from "./identity/deactivation/index";
import { sendAccountEmail } from "./identity/mail/sender";
import { signInAvailability } from "./identity/signin_policy";
import { authenticationDecision } from "./identity/instance/authentication";
import { mailConfiguration } from "./identity/mail/config";
import { z } from "zod/v4";
import { zodToConvex } from "convex-helpers/server/zod4";
import { requireSignup } from "./identity/signup_policy";
import { nativeOAuthProviders } from "./identity/oauth/providers";
import { runtimeOAuth } from "./identity/instance/oauth";
import { oauthProviderIds, oauthConfigurations } from "./identity/oauth/config";
import { passwordAttemptWindowMs } from "./identity/password/policy";
import { normalizedEmail } from "./invitations/access";
import { instanceAuthentication, lastLoginMedium } from "./identity/schema";
import { allocateUserApiId } from "./identity/user_owner";

export const siteUrl = process.env.SITE_URL ?? "";

const authFunctions: AuthFunctions = internal.better_auth;
export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
  local: { schema: authSchema },
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, user) => {
        const existing = await existingAppUser(ctx, user.email);
        if (existing && existing.emailVerificationTime === undefined && !user.emailVerified)
          throw new ConvexError("This account must be verified before migration.");
        if (!existing) await requireSignup(ctx, user.email);
        if (user.emailVerified) await linkVerifiedUser(ctx, user._id, user.email, user.name);
      },
      onUpdate: async (ctx, user, previous) => {
        if (user.emailVerified) await linkVerifiedUser(ctx, user._id, user.email, user.name, previous.email);
      },
      onDelete: async (ctx, user) => {
        const link = await ctx.db
          .query("betterAuthLinks")
          .withIndex("by_auth_id", (q) => q.eq("authId", user._id))
          .unique();
        if (link) {
          await deactivateAccount(ctx, link.userId);
          await ctx.db.delete(link._id);
        }
        const { adapter } = await createAuth(ctx).$context;
        await adapter.deleteMany({ model: "apikey", where: [{ field: "referenceId", value: user._id }] });
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const recordSignIn = internalMutation({
  args: { authId: v.string(), medium: lastLoginMedium, createdAt: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const link = await ctx.db
      .query("betterAuthLinks")
      .withIndex("by_auth_id", (q) => q.eq("authId", args.authId))
      .unique();
    if (!link || (link.lastLoginAt !== undefined && link.lastLoginAt >= args.createdAt)) return;
    await ctx.db.patch(link._id, { lastLoginMedium: args.medium, lastLoginAt: args.createdAt });
  },
});

// Operator-only cutover: preserve application IDs and the compatible canonical
// Scrypt hash. Unverified, restricted, or ambiguous identities fail closed.
export const migrateAccount = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user?.email || user.emailVerificationTime === undefined)
      throw new ConvexError("Verify this account before migration.");
    if (normalizedEmail(user.email) !== user.email || (await existingAppUser(ctx, user.email))?._id !== user._id)
      throw new ConvexError("Email identity is ambiguous.");
    const passwords = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id).eq("provider", "password"))
      .take(2);
    if (passwords.length > 1) throw new ConvexError("Password identity is ambiguous.");
    const password = passwords[0]?.secret;
    if (password && !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(password))
      throw new ConvexError("This credential requires a password reset before migration.");
    const { internalAdapter } = await createAuth(ctx).$context;
    const existing = await internalAdapter.findUserByEmail(user.email);
    if (existing && !existing.user.emailVerified) throw new ConvexError("Native account must be verified first.");
    const authUser =
      existing?.user ??
      (await internalAdapter.createUser({ name: user.name ?? user.email, email: user.email, emailVerified: true }));
    await linkVerifiedUser(ctx, authUser.id, authUser.email, authUser.name);
    const accounts = await internalAdapter.findAccounts(authUser.id);
    if (password && !accounts.some((account) => account.providerId === "credential"))
      await internalAdapter.createAccount({
        userId: authUser.id,
        accountId: authUser.id,
        providerId: "credential",
        password,
      });
    return { userId: user._id, authId: authUser.id };
  },
});

async function existingAppUser(ctx: MutationCtx, email: string) {
  const matches = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .take(2);
  if (matches.length > 1) throw new ConvexError("Email identity is ambiguous.");
  const existing = matches[0];
  if (existing) await requireUnrestrictedAccount(ctx, existing._id);
  return existing ?? null;
}

async function linkVerifiedUser(
  ctx: MutationCtx,
  authId: string,
  email: string,
  name: string,
  previousEmail?: string
): Promise<void> {
  const link = await ctx.db
    .query("betterAuthLinks")
    .withIndex("by_auth_id", (q) => q.eq("authId", authId))
    .unique();
  if (link) {
    const owner = await ctx.db.get(link.userId);
    if (!owner) throw new ConvexError("Account is unavailable.");
    await requireUnrestrictedAccount(ctx, owner._id);
    if (owner.email !== email) {
      if (owner.email !== previousEmail) throw new ConvexError("Account email changed. Sign in again.");
      const collision = await existingAppUser(ctx, email);
      if (collision && collision._id !== owner._id) throw new ConvexError("Email address is unavailable.");
      await ctx.db.patch(owner._id, { email, emailVerificationTime: Date.now() });
      const { internalAdapter } = await createAuth(ctx).$context;
      await internalAdapter.deleteUserSessions(authId);
      if (owner.email) {
        const id = await ctx.db.insert("emailChangeNotices", {
          userId: owner._id,
          recipient: owner.email,
          attempts: 0,
          status: "pending",
        });
        await ctx.scheduler.runAfter(0, internal.identity.emailChange.notifications.deliver, { id });
      }
    }
    return;
  }
  const appUser = await existingAppUser(ctx, email);
  let userId = appUser?._id;
  if (!userId)
    userId = await ctx.db.insert("users", {
      apiId: await allocateUserApiId(ctx),
      email,
      name,
      emailVerificationTime: Date.now(),
    });
  const existing = await ctx.db
    .query("betterAuthLinks")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (existing) throw new ConvexError("This account is already linked.");
  if (appUser && appUser.emailVerificationTime === undefined)
    await ctx.db.patch(appUser._id, { emailVerificationTime: Date.now() });
  await ctx.db.insert("betterAuthLinks", { authId, userId });
}

// The native adapter's increment fallback spans separate HTTP adapter calls.
// Consume the native rate row inside one Convex mutation instead.
export const consumeHttpRateLimit = internalMutation({
  args: { key: v.string(), window: v.number(), max: v.number() },
  handler: async (ctx, { key, window, max }) => {
    const { adapter } = await createAuth(ctx).$context;
    const where = [{ field: "key", value: key }];
    const existing = await adapter.findOne<RateLimit>({ model: "rateLimit", where });
    const now = Date.now();
    const count = existing && now - existing.lastRequest <= window * 1000 ? existing.count : 0;
    if (existing && count >= max)
      return { allowed: false, retryAfter: Math.ceil((existing.lastRequest + window * 1000 - now) / 1000) };
    const update = { count: count + 1, lastRequest: now };
    if (existing) await adapter.updateMany({ model: "rateLimit", where, update });
    else await adapter.create<RateLimit>({ model: "rateLimit", data: { key, ...update } });
    return { allowed: true, retryAfter: null };
  },
});

export const expireRateLimits = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    // The effective native HTTP rules are at most 60 seconds; application
    // password attempts fully refill within an hour. Retain both for two hours.
    const page = await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: {
        model: "rateLimit",
        where: [{ field: "lastRequest", operator: "lt", value: Date.now() - passwordAttemptWindowMs * 2 }],
      },
      // The installed native adapter caps this page at 200 rows read.
      paginationOpts: { cursor: args.cursor, numItems: 100 },
    });
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.better_auth.expireRateLimits, { cursor: page.continueCursor });
  },
});

export const authenticationPolicy = internalQuery({
  args: { subject: v.optional(v.object({ authId: v.string(), email: v.string() })) },
  returns: v.object({ authentication: zodToConvex(instanceAuthentication), administratorPassword: v.boolean() }),
  handler: async (ctx, args) => authenticationDecision(ctx, args.subject),
});

// Two actual issuer seams consume this proof: before credential/OTP/OAuth work,
// and again after native verification but before the session is persisted.
async function requireAuthenticationMethod(
  ctx: GenericCtx<DataModel>,
  path: string,
  body: unknown,
  providerId: unknown,
  subject?: Parameters<typeof authenticationDecision>[1]
) {
  const otp = z
    .object({ type: z.enum(["sign-in", "forget-password", "email-verification", "change-email"]) })
    .safeParse(body);
  let method: "password" | "magic" | "passwordReset" | "oauth" | undefined;
  if (["/sign-in/email", "/sign-up/email"].includes(path)) method = "password";
  else if (path === "/sign-in/email-otp") method = "magic";
  else if (
    [
      "/email-otp/request-password-reset",
      "/forget-password/email-otp",
      "/email-otp/reset-password",
      "/request-password-reset",
      "/reset-password",
    ].includes(path) ||
    path.startsWith("/reset-password/")
  )
    method = "passwordReset";
  else if (["/sign-in/oauth2", "/oauth2/link", "/oauth2/callback/:providerId"].includes(path)) method = "oauth";
  else if (["/email-otp/send-verification-otp", "/email-otp/check-verification-otp"].includes(path) && otp.success) {
    if (otp.data.type === "sign-in") method = "magic";
    if (otp.data.type === "forget-password") method = "passwordReset";
  }
  if (!method) return;
  const decision =
    "db" in ctx
      ? await authenticationDecision(ctx, subject)
      : await ctx.runQuery(internal.better_auth.authenticationPolicy, { subject });
  const policy = signInAvailability(
    decision.authentication.passwordEnabled || decision.administratorPassword,
    decision.authentication.magicEnabled,
    mailConfiguration(process.env) !== null
  );
  if (method !== "oauth" && !policy[method])
    throw new APIError("FORBIDDEN", { message: "This sign-in method is disabled by the instance administrator." });
  if (method === "oauth") {
    const input = z.object({ providerId: z.enum(oauthProviderIds) }).safeParse(body);
    const provider = z
      .enum(oauthProviderIds)
      .safeParse(providerId ?? (input.success ? input.data.providerId : undefined));
    if (!provider.success || !decision.authentication.providers[provider.data])
      throw new APIError("FORBIDDEN", { message: "This OAuth provider is disabled by the instance administrator." });
  }
}

export const oauthConfiguration = internalQuery({ args: {}, handler: (ctx) => runtimeOAuth(ctx) });

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  // Both native generic handlers and refresh closures share this factory-local
  // configuration. The global schema/introspection options remain unchanged.
  const oauth = "db" in ctx ? runtimeOAuth(ctx) : ctx.runQuery(internal.better_auth.oauthConfiguration, {});
  const oauthOptions: Parameters<typeof genericOAuth>[0] = { config: [] };
  const oauthPlugin = genericOAuth(oauthOptions);
  const requestOAuth = {
    ...oauthPlugin,
    init: async (context: Parameters<NonNullable<typeof oauthPlugin.init>>[0]) => {
      oauthOptions.config = nativeOAuthProviders((await oauth).configurations);
      return oauthPlugin.init(context);
    },
  };
  const rateLimitStorage: NonNullable<BetterAuthRateLimitOptions["customStorage"]> = {
    get: async (key) => {
      const { adapter } = await createAuth(ctx).$context;
      return adapter.findOne<RateLimit>({ model: "rateLimit", where: [{ field: "key", value: key }] });
    },
    set: async (key, value, update) => {
      const { adapter } = await createAuth(ctx).$context;
      if (update)
        await adapter.updateMany({ model: "rateLimit", where: [{ field: "key", value: key }], update: value });
      else await adapter.create<RateLimit>({ model: "rateLimit", data: { ...value, key } });
    },
    consume: async (key, rule) => {
      if (!("runMutation" in ctx)) throw new Error("HTTP rate consumption requires a mutation-capable context.");
      return ctx.runMutation(internal.better_auth.consumeHttpRateLimit, { key, ...rule });
    },
  };
  return betterAuth({
    ...authOptions,
    database: authComponent.adapter(ctx),
    plugins: authOptions.plugins.map((plugin) => (plugin.id === "generic-oauth" ? requestOAuth : plugin)),
    rateLimit: { ...authOptions.rateLimit, customStorage: rateLimitStorage },
    databaseHooks: {
      session: {
        create: {
          before: async (session, request) => {
            if (!request?.path) return;
            const user =
              request.path === "/sign-in/email"
                ? await request.context.internalAdapter.findUserById(session.userId)
                : null;
            await requireAuthenticationMethod(
              ctx,
              request.path,
              request.body,
              request.params?.providerId,
              user?.emailVerified ? { authId: user.id, email: user.email } : undefined
            );
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (request) => {
        if (["/sign-in/oauth2", "/oauth2/link", "/oauth2/callback/:providerId"].includes(request.path)) {
          const configuration = await oauth;
          if (configuration.adoptionRequired)
            throw new APIError("FORBIDDEN", { message: "OAuth configuration requires explicit operator adoption." });
        }
        const email = z.email().safeParse(request.body?.email);
        const current =
          request.path === "/sign-in/email" && email.success
            ? await request.context.internalAdapter.findUserByEmail(normalizedEmail(email.data))
            : null;
        await requireAuthenticationMethod(
          ctx,
          request.path,
          request.body,
          request.params?.providerId,
          current?.user.emailVerified ? { authId: current.user.id, email: current.user.email } : undefined
        );
      }),
      after: createAuthMiddleware(async (request) => {
        const session = request.context.newSession;
        if (!session) return;
        const medium =
          request.path === "/sign-in/email"
            ? "email"
            : request.path === "/sign-in/email-otp"
              ? "magic-code"
              : request.path === "/oauth2/callback/:providerId"
                ? (await oauth).configurations.find((provider) => provider.id === request.params?.providerId)?.id
                : undefined;
        if (!medium) return;
        // Native issuance and metadata are separate HTTP transactions. The
        // scheduler owns retries; the native helper reports handoff failures.
        await request.context.runInBackgroundOrAwait(
          requireRunMutationCtx(ctx).scheduler.runAfter(0, internal.better_auth.recordSignIn, {
            authId: session.user.id,
            medium,
            createdAt: Number(session.session.createdAt),
          })
        );
      }),
    },
  });
};

// The documented local component and runtime share the native plugin schema.
// The database adapter, HTTP limiter, and sign-in recorder require a runtime context.
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
    genericOAuth({ config: nativeOAuthProviders(oauthConfigurations(process.env)) }),
    emailOTP({
      overrideDefaultEmailVerification: true,
      changeEmail: { enabled: true, verifyCurrentEmail: true },
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
} satisfies BetterAuthOptions;
