import { requireSignup } from "./signup_policy";
import type { ConvexAuthConfig } from "@convex-dev/auth/server";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { requireUnrestrictedAccount } from "./deactivation/access";
import { apiIdSchema } from "./schema";

export async function allocateUserApiId(ctx: MutationCtx) {
  const apiId = apiIdSchema.parse(crypto.randomUUID());
  const existing = await ctx.db
    .query("users")
    .withIndex("by_api_id", (q) => q.eq("apiId", apiId))
    .unique();
  if (existing) throw new ConvexError("User API identifier already exists.");
  return apiId;
}
type Callback = NonNullable<NonNullable<ConvexAuthConfig["callbacks"]>["createOrUpdateUser"]>;
// The installed package passes shouldLinkViaEmail (users.ts); its public callback type omits that optional field.
type Input = Parameters<Callback>[1] & { shouldLinkViaEmail?: boolean };
export async function createOrUpdateUser(ctx: MutationCtx, args: Input) {
  const email = args.profile.email;
  if (!email) throw new ConvexError("An email address is required.");
  if (args.existingUserId) {
    await requireUnrestrictedAccount(ctx, args.existingUserId);
    const user = await ctx.db.get(args.existingUserId);
    if (!user) throw new ConvexError("Account is unavailable.");
    // Provider subjects retain their original user. An old OAuth email claim must never rename that user.
    if (user.email === email && args.profile.emailVerified === true)
      await ctx.db.patch(user._id, { emailVerificationTime: Date.now() });
    return user._id;
  }
  const mayLink =
    args.profile.emailVerified === true || args.provider.type === "email" || args.shouldLinkViaEmail === true;
  if (mayLink) {
    const matches = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .filter((q) => q.neq(q.field("emailVerificationTime"), undefined))
      .take(2);
    if (matches.length > 1) throw new ConvexError("Email identity is ambiguous.");
    if (matches.length === 1) {
      await requireUnrestrictedAccount(ctx, matches[0]._id);
      return matches[0]._id;
    }
  }
  await requireSignup(ctx, email);
  return ctx.db.insert("users", {
    apiId: await allocateUserApiId(ctx),
    email,
    ...(args.profile.emailVerified === true ? { emailVerificationTime: Date.now() } : {}),
    ...(typeof args.profile.name === "string" ? { name: args.profile.name } : {}),
    ...(typeof args.profile.image === "string" ? { image: args.profile.image } : {}),
  });
}

// Temporary stored-row rollout: remove after every deployment proves complete
// UUID coverage and the users schema requires apiId. Never allocate on reads.
export const backfillApiIds = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("users")
      .paginate({ cursor, numItems: 50, maximumRowsRead: 50, maximumBytesRead: 1048576 });
    let changed = 0;
    // Sequential writes make each uniqueness check see previously allocated IDs.
    /* oxlint-disable no-await-in-loop */
    for (const user of page.page) {
      if (user.apiId === undefined) {
        await ctx.db.patch(user._id, { apiId: await allocateUserApiId(ctx) });
        changed++;
      } else {
        const apiId = apiIdSchema.parse(user.apiId);
        await ctx.db
          .query("users")
          .withIndex("by_api_id", (q) => q.eq("apiId", apiId))
          .unique();
      }
    }
    /* oxlint-enable no-await-in-loop */
    return { processed: page.page.length, changed, continueCursor: page.continueCursor, isDone: page.isDone };
  },
});
