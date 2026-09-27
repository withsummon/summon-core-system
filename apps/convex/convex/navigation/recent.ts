import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { visibleTarget } from "../favorites/targets";
import { visitTarget } from "./schema";
// Only the authenticated navigation producer records a visit; reactive reads remain side-effect free.
export const record = mutation({
  args: { workspaceId: v.id("workspaces"), target: visitTarget },
  handler: async (ctx, args) => {
    const { user, member } = await requireWorkspace(ctx, args.workspaceId);
    if (!(await visibleTarget(ctx, args.target, member))) throw new ConvexError("Visited item is unavailable.");
    const key = `${args.target.type}:${args.target.id}`;
    const existing = await ctx.db
      .query("recentVisits")
      .withIndex("by_target", (q) => q.eq("workspaceId", args.workspaceId).eq("userId", user._id).eq("targetKey", key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { visitedAt: Math.max(Date.now(), existing.visitedAt + 1) });
      return existing._id;
    }
    const rows = await ctx.db
      .query("recentVisits")
      .withIndex("by_owner", (q) => q.eq("workspaceId", args.workspaceId).eq("userId", user._id))
      .order("asc")
      .take(20);
    if (rows.length === 20) await ctx.db.delete(rows[0]._id);
    return ctx.db.insert("recentVisits", { ...args, userId: user._id, targetKey: key, visitedAt: Date.now() });
  },
});
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    type: v.optional(v.union(v.literal("issue"), v.literal("page"), v.literal("project"))),
  },
  handler: async (ctx, args) => {
    const { user, member } = await requireWorkspace(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("recentVisits")
      .withIndex("by_owner", (q) => q.eq("workspaceId", args.workspaceId).eq("userId", user._id))
      .order("desc")
      .take(20);
    const result = await Promise.all(
      rows.map(async (row) => {
        if (args.type && row.target.type !== args.type) return null;
        const entity = await visibleTarget(ctx, row.target, member);
        return entity
          ? { id: row._id, target: row.target, visitedAt: row.visitedAt, createdAt: row._creationTime, entity }
          : null;
      })
    );
    return result.filter((row) => row !== null);
  },
});
