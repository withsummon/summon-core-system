import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "../../_generated/server";
import type { QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { requireUser } from "../session";
import { requireUnrestrictedAccount } from "../deactivation/access";
import { zodToConvexFields } from "convex-helpers/server/zod4";
import { instanceGeneral, instanceIdentifier } from "../schema";
export async function requireNotInstanceAdmin(ctx: QueryCtx, userId: Id<"users">) {
  const setup = await ctx.db
    .query("instanceAuthority")
    .withIndex("by_key", (q) => q.eq("key", "instance"))
    .unique();
  if (!setup)
    throw new ConvexError("Instance authority must be initialized by an operator before account deactivation.");
  const membership = await ctx.db
    .query("instanceAdmins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (membership) throw new ConvexError("Instance administrators cannot deactivate their account.");
}
// Operator-only deployment function. Never invoked from a public setup route or automatically.
export const bootstrap = internalMutation({
  args: {
    userId: v.id("users"),
    expectedEmail: v.string(),
    ...zodToConvexFields(instanceGeneral.shape),
  },
  handler: async (ctx, args) => {
    const setup = await ctx.db
      .query("instanceAuthority")
      .withIndex("by_key", (q) => q.eq("key", "instance"))
      .unique();
    const existing = await ctx.db.query("instanceAdmins").first();
    if (setup || existing) throw new ConvexError("Instance authority is already initialized.");
    const user = await ctx.db.get(args.userId);
    if (!user || !user.email || user.email !== args.expectedEmail || user.emailVerificationTime === undefined)
      throw new ConvexError("A verified operator-selected account with the exact email is required.");
    await requireUnrestrictedAccount(ctx, user._id);
    const instanceId = await ctx.db.insert("instanceAuthority", {
      key: "instance",
      initializedAt: Date.now(),
      ...instanceGeneral.parse(args),
      instanceId: instanceIdentifier.parse(
        Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, "0")).join("")
      ),
      revision: 1,
    });
    await ctx.db.insert("instanceAdmins", { instanceId, userId: user._id, role: "admin", revision: 1 });
  },
});
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const membership = await ctx.db
      .query("instanceAdmins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    return { isInstanceAdmin: membership !== null };
  },
});
