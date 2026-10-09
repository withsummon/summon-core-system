import { ConvexError } from "convex/values";
import type { QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { requireUser } from "../session";
export async function instanceAdminAccess(ctx: QueryCtx, userId: Id<"users">) {
  const instance = await ctx.db
    .query("instanceAuthority")
    .withIndex("by_key", (q) => q.eq("key", "instance"))
    .unique();
  const member = await ctx.db
    .query("instanceAdmins")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return { instance, member };
}
export async function requireInstanceAdmin(ctx: QueryCtx) {
  const user = await requireUser(ctx);
  const { instance, member } = await instanceAdminAccess(ctx, user._id);
  if (!instance) throw new ConvexError("Instance authority is not initialized.");
  if (!member || member.instanceId !== instance._id)
    throw new ConvexError("Instance administrator access is required.");
  return { user, instance, member };
}
