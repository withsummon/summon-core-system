import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { stickyInput } from "./schema";
import { stickyContent, stickyJson, stickyString, stickyBinary, stickyOrder } from "./content";
async function requireSticky(ctx: QueryCtx, workspaceId: Id<"workspaces">, stickyId: Id<"stickies">, deleted = false) {
  const { user } = await requireWorkspace(ctx, workspaceId);
  const row = await ctx.db.get(stickyId);
  if (!row || row.workspaceId !== workspaceId || row.ownerId !== user._id || (!deleted && row.deletedAt !== null))
    throw new ConvexError("Sticky not found.");
  return row;
}
function revision(row: Doc<"stickies">, expected: number) {
  if (!Number.isSafeInteger(expected) || row.updatedAt !== expected)
    throw new ConvexError("This sticky changed. Reopen it before saving.");
  return Math.max(Date.now(), row.updatedAt + 1);
}
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    deleted: v.boolean(),
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    if (args.query.length > 1000) throw new ConvexError("Search must be at most 1000 characters.");
    const result = await ctx.db
      .query("stickies")
      .withIndex("by_owner_order", (q) =>
        args.deleted
          ? q.eq("workspaceId", args.workspaceId).eq("ownerId", user._id).gt("deletedAt", null)
          : q.eq("workspaceId", args.workspaceId).eq("ownerId", user._id).eq("deletedAt", null)
      )
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return {
      ...result,
      page: result.page.filter((row) => row.description.toLowerCase().includes(args.query.toLowerCase())),
    };
  },
});
export const get = query({
  args: { workspaceId: v.id("workspaces"), stickyId: v.id("stickies") },
  handler: (ctx, args) => requireSticky(ctx, args.workspaceId, args.stickyId, true),
});
export const create = mutation({
  args: { workspaceId: v.id("workspaces"), ...stickyInput },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    stickyJson(args.logoProps ?? {}, "Logo properties", 10000);
    const latest = await ctx.db
      .query("stickies")
      .withIndex("by_owner_order", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("ownerId", user._id).eq("deletedAt", null)
      )
      .order("desc")
      .first();
    return ctx.db.insert("stickies", {
      workspaceId: args.workspaceId,
      ownerId: user._id,
      name: stickyString(args.name ?? null, "Name", 10000),
      ...stickyContent(args.html ?? "<p></p>"),
      editorJson: stickyJson(args.editorJson === undefined ? {} : args.editorJson, "Editor JSON", 100000),
      editorBinary: stickyBinary(args.editorBinary ?? null),
      color: stickyString(args.color ?? null, "Color", 255),
      backgroundColor: stickyString(args.backgroundColor ?? null, "Background color", 255),
      logoProps: args.logoProps ?? {},
      sortOrder: stickyOrder(latest ? latest.sortOrder + 10000 : 65535),
      updatedAt: Date.now(),
      deletedAt: null,
    });
  },
});
export const update = mutation({
  args: { workspaceId: v.id("workspaces"), stickyId: v.id("stickies"), expectedUpdatedAt: v.number(), ...stickyInput },
  handler: async (ctx, args) => {
    const row = await requireSticky(ctx, args.workspaceId, args.stickyId);
    const updatedAt = revision(row, args.expectedUpdatedAt);
    const patch: Partial<Doc<"stickies">> = { updatedAt };
    if (args.name !== undefined) patch.name = stickyString(args.name, "Name", 10000);
    if (args.html !== undefined) Object.assign(patch, stickyContent(args.html));
    if (args.editorJson !== undefined) patch.editorJson = stickyJson(args.editorJson, "Editor JSON", 100000);
    if (args.editorBinary !== undefined) patch.editorBinary = stickyBinary(args.editorBinary);
    if (args.color !== undefined) patch.color = stickyString(args.color, "Color", 255);
    if (args.backgroundColor !== undefined)
      patch.backgroundColor = stickyString(args.backgroundColor, "Background color", 255);
    if (args.logoProps !== undefined) {
      stickyJson(args.logoProps, "Logo properties", 10000);
      patch.logoProps = args.logoProps;
    }
    await ctx.db.patch(row._id, patch);
  },
});
export const reorder = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    stickyId: v.id("stickies"),
    expectedUpdatedAt: v.number(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await requireSticky(ctx, args.workspaceId, args.stickyId);
    await ctx.db.patch(row._id, {
      sortOrder: stickyOrder(args.sortOrder),
      updatedAt: revision(row, args.expectedUpdatedAt),
    });
  },
});
export const remove = mutation({
  args: { workspaceId: v.id("workspaces"), stickyId: v.id("stickies"), expectedUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const row = await requireSticky(ctx, args.workspaceId, args.stickyId);
    await ctx.db.patch(row._id, { deletedAt: Date.now(), updatedAt: revision(row, args.expectedUpdatedAt) });
  },
});
export const restore = mutation({
  args: { workspaceId: v.id("workspaces"), stickyId: v.id("stickies"), expectedUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const row = await requireSticky(ctx, args.workspaceId, args.stickyId, true);
    if (row.deletedAt === null) throw new ConvexError("Sticky is not in Trash.");
    await ctx.db.patch(row._id, { deletedAt: null, updatedAt: revision(row, args.expectedUpdatedAt) });
  },
});

export const resolve = query({
  args: { workspaceId: v.id("workspaces"), stickyId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("stickies", args.stickyId);
    if (!id) throw new ConvexError("Sticky not found.");
    return requireSticky(ctx, args.workspaceId, id, true);
  },
});
