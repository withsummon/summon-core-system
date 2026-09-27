import { v, ConvexError } from "convex/values";
import { query } from "../_generated/server";
import { normalizedEmail } from "../invitations/access";
import { signInPolicy } from "./signin_policy";
import { canSignUp } from "./signup_policy";
export const check = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalizedEmail(args.email);
    const users = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .take(2);
    if (users.length > 1) throw new ConvexError("Email identity is ambiguous. Contact your instance administrator.");
    const user = users[0];
    const passwords = user
      ? await ctx.db
          .query("authAccounts")
          .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id).eq("provider", "password"))
          .take(2)
      : [];
    const hasPassword = passwords.some((account) => Boolean(account.secret));
    const policy = signInPolicy(process.env);
    const method =
      policy.magic && (!user || !hasPassword) ? "magic" : policy.password ? "password" : policy.magic ? "magic" : null;
    return { email, existing: Boolean(user), method, canSignUp: user ? false : await canSignUp(ctx, email) };
  },
});
