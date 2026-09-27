import { ConvexError } from "convex/values";
import type { QueryCtx } from "../../_generated/server";
import { requireIdentity } from "../session";
export async function requireInstanceAdmin(ctx: QueryCtx) {
  const { user } = await requireIdentity(ctx);
  const instance = await ctx.db
    .query("instanceAuthority")
    .withIndex("by_key", (q) => q.eq("key", "instance"))
    .unique();
  if (!instance) throw new ConvexError("Instance authority is not initialized.");
  const member = await ctx.db
    .query("instanceAdmins")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .unique();
  if (!member || member.instanceId !== instance._id)
    throw new ConvexError("Instance administrator access is required.");
  return { user, instance, member };
}
