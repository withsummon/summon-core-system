import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { preferenceKey } from "./schema";
const keys: Infer<typeof preferenceKey>[] = [
  "views",
  "active_cycles",
  "analytics",
  "drafts",
  "your_work",
  "archives",
  "stickies",
];
async function seed(ctx: MutationCtx, workspaceId: Id<"workspaces">, userId: Id<"users">) {
  const rows = await ctx.db
    .query("sidebarPreferences")
    .withIndex("by_owner", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
    .take(7);
  await Promise.all(
    keys.map(async (key, index) => {
      if (!rows.some((row) => row.key === key))
        await ctx.db.insert("sidebarPreferences", {
          workspaceId,
          userId,
          key,
          isPinned: ["drafts", "your_work", "stickies"].includes(key),
          sortOrder: 65535 + index * 10000,
          revision: 0,
        });
    })
  );
}
export const ensure = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    await seed(ctx, args.workspaceId, user._id);
  },
});
export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    const rows = await ctx.db
      .query("sidebarPreferences")
      .withIndex("by_owner", (q) => q.eq("workspaceId", args.workspaceId).eq("userId", user._id))
      .take(7);
    // Fresh database result; ES2022 clients do not expose toSorted.
    return {
      initialized: rows.length === keys.length,
      // oxlint-disable-next-line unicorn/no-array-sort
      preferences: rows.sort((a, b) => a.sortOrder - b.sortOrder || keys.indexOf(a.key) - keys.indexOf(b.key)),
    };
  },
});
export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    changes: v.array(
      v.object({
        key: preferenceKey,
        expectedRevision: v.number(),
        isPinned: v.optional(v.boolean()),
        sortOrder: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    if (args.changes.length > 7 || new Set(args.changes.map((change) => change.key)).size !== args.changes.length)
      throw new ConvexError("Choose up to seven distinct preferences.");
    await Promise.all(
      args.changes.map(async (change) => {
        const row = await ctx.db
          .query("sidebarPreferences")
          .withIndex("by_key", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("userId", user._id).eq("key", change.key)
          )
          .unique();
        if (!row) throw new ConvexError("Initialize sidebar preferences first.");
        if (change.expectedRevision !== row.revision)
          throw new ConvexError("Sidebar preference changed. Reload before saving.");
        if (
          change.sortOrder !== undefined &&
          (!Number.isFinite(change.sortOrder) || Math.abs(change.sortOrder) > Number.MAX_SAFE_INTEGER)
        )
          throw new ConvexError("Invalid sidebar order.");
        await ctx.db.patch(row._id, {
          isPinned: change.isPinned ?? row.isPinned,
          sortOrder: change.sortOrder ?? row.sortOrder,
          revision: row.revision + 1,
        });
      })
    );
  },
});
