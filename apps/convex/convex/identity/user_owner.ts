import type { ConvexAuthConfig } from "@convex-dev/auth/server";
import type { MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { requireUnrestrictedAccount } from "./deactivation/access";
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
  return ctx.db.insert("users", {
    email,
    ...(args.profile.emailVerified === true ? { emailVerificationTime: Date.now() } : {}),
    ...(typeof args.profile.name === "string" ? { name: args.profile.name } : {}),
    ...(typeof args.profile.image === "string" ? { image: args.profile.image } : {}),
  });
}
