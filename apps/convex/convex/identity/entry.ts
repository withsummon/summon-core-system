import { v } from "convex/values";
import { query } from "../_generated/server";
import { createAuth } from "../better_auth";
import { normalizedEmail } from "../invitations/access";
import { currentSignInPolicy } from "./signin_policy";
import { canSignUp } from "./signup_policy";
export const check = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalizedEmail(args.email);
    const { internalAdapter } = await createAuth(ctx).$context;
    const current = await internalAdapter.findUserByEmail(email);
    const hasPassword = current?.accounts.some((account) => account.providerId === "credential" && account.password);
    const policy = await currentSignInPolicy(
      ctx,
      current?.user.emailVerified ? { authId: current.user.id, email: current.user.email } : undefined
    );
    const method =
      policy.magic && !hasPassword ? "magic" : policy.password ? "password" : policy.magic ? "magic" : null;
    return { email, existing: Boolean(current), method, canSignUp: current ? false : await canSignUp(ctx, email) };
  },
});
