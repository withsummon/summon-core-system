import { requireWorkspace } from "../identity/access";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import { pageBudget } from "../commercial/validation";
import { favoriteTarget } from "./schema";
import { visibleTarget, targetKey } from "./targets";
import { favoriteAccess, ownFavorite, ancestors, revision, updateHeights } from "./access";
function validateName(name: string | null) {
  if (name !== null && name.length > 255) throw new ConvexError("Favorite name must be at most 255 characters.");
}
function validateSequence(sequence: number) {
  if (!Number.isFinite(sequence) || Math.abs(sequence) > Number.MAX_SAFE_INTEGER)
    throw new ConvexError("Favorite order must be a finite safe number.");
}
function viewMigration(type: string) {
  if (type === "view") throw new ConvexError("Saved view favorites are awaiting the shared-owner cutover.");
}
export const access = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { member } = await requireWorkspace(ctx, args.workspaceId);
    return { canManage: member.role !== "guest", maxDepth: 20, canManageViews: false };
  },
});
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    parentId: v.union(v.id("favorites"), v.null()),
    deleted: v.boolean(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { user, member } = await favoriteAccess(ctx, args.workspaceId);
    const chain = await ancestors(ctx, { parentId: args.parentId, workspaceId: args.workspaceId, userId: user._id });
    if (chain.some((row) => row.deletedAt !== null)) throw new ConvexError("Restore the parent folder first.");
    const result = await ctx.db
      .query("favorites")
      .withIndex("by_owner_parent_order", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id).eq("parentId", args.parentId)
      )
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (row) => {
        if ((row.deletedAt !== null) !== args.deleted) return null;
        const target = await visibleTarget(ctx, row.target, member);
        if (!target) return null;
        return { ...row, entity: target, canManage: row.target.type !== "view" };
      })
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
});
export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    target: favoriteTarget,
    name: v.union(v.string(), v.null()),
    parentId: v.union(v.id("favorites"), v.null()),
  },
  handler: async (ctx, args) => {
    const { user, member } = await favoriteAccess(ctx, args.workspaceId);
    viewMigration(args.target.type);
    validateName(args.name);
    const target = await visibleTarget(ctx, args.target, member);
    if (!target?.canFavorite) throw new ConvexError("Favorite target is unavailable.");
    const chain = await ancestors(ctx, { ...args, userId: user._id });
    if (chain.length + 1 > 20 || chain.some((row) => row.deletedAt !== null))
      throw new ConvexError("Choose an active folder within the 20-level limit.");
    const key = targetKey(args.target);
    if (key) {
      const existing = await ctx.db
        .query("favorites")
        .withIndex("by_owner_target", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("userId", user._id).eq("targetKey", key)
        )
        .unique();
      if (existing) {
        if (existing.deletedAt !== null || (await ancestors(ctx, existing)).some((item) => item.deletedAt !== null))
          throw new ConvexError("Restore the existing favorite and its parent folder first.");
        return existing._id;
      }
    }
    const last = await ctx.db
      .query("favorites")
      .withIndex("by_owner_parent_order", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id).eq("parentId", args.parentId)
      )
      .order("desc")
      .first();
    const sequence = last ? last.sequence + 10000 : 65535;
    validateSequence(sequence);
    const id = await ctx.db.insert("favorites", {
      ...args,
      userId: user._id,
      targetType: args.target.type,
      targetProjectId: target.projectId,
      targetKey: key,
      sequence,
      height: 1,
      favoritedAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
    });
    await updateHeights(ctx, chain);
    return id;
  },
});
export const update = mutation({
  args: {
    favoriteId: v.id("favorites"),
    expectedUpdatedAt: v.number(),
    name: v.union(v.string(), v.null()),
    parentId: v.union(v.id("favorites"), v.null()),
    sequence: v.number(),
  },
  handler: async (ctx, args) => {
    const { row } = await ownFavorite(ctx, args.favoriteId);
    viewMigration(row.target.type);
    const updatedAt = revision(row, args.expectedUpdatedAt);
    validateName(args.name);
    validateSequence(args.sequence);
    const oldChain = await ancestors(ctx, row);
    const chain = await ancestors(ctx, { ...row, parentId: args.parentId }, row._id);
    if (
      row.deletedAt !== null ||
      oldChain.some((item) => item.deletedAt !== null) ||
      chain.some((item) => item.deletedAt !== null)
    )
      throw new ConvexError("Restore the favorite folder first.");
    if (chain.length + row.height > 20) throw new ConvexError("Favorite folders cannot exceed 20 levels.");
    await ctx.db.patch(row._id, { name: args.name, parentId: args.parentId, sequence: args.sequence, updatedAt });
    await updateHeights(ctx, oldChain);
    await updateHeights(ctx, chain);
  },
});
export const lifecycle = mutation({
  args: { favoriteId: v.id("favorites"), expectedUpdatedAt: v.number(), deleted: v.boolean() },
  handler: async (ctx, args) => {
    const { row, member } = await ownFavorite(ctx, args.favoriteId);
    viewMigration(row.target.type);
    const updatedAt = revision(row, args.expectedUpdatedAt);
    if ((row.deletedAt !== null) === args.deleted) throw new ConvexError("Favorite lifecycle already changed.");
    const chain = await ancestors(ctx, row);
    if (chain.some((item) => item.deletedAt !== null)) throw new ConvexError("Restore the parent folder first.");
    if (!args.deleted && !(await visibleTarget(ctx, row.target, member))?.canFavorite)
      throw new ConvexError("Favorite target is unavailable.");
    await ctx.db.patch(row._id, {
      deletedAt: args.deleted ? Date.now() : null,
      favoritedAt: args.deleted ? row.favoritedAt : Date.now(),
      updatedAt,
    });
  },
});

export const state = query({
  args: { workspaceId: v.id("workspaces"), target: favoriteTarget },
  handler: async (ctx, args) => {
    const { user, member } = await favoriteAccess(ctx, args.workspaceId);
    viewMigration(args.target.type);
    const key = targetKey(args.target);
    if (!key) throw new ConvexError("Choose an entity to inspect its favorite state.");
    const target = await visibleTarget(ctx, args.target, member);
    if (!target) throw new ConvexError("Favorite target is unavailable.");
    const favorite = await ctx.db
      .query("favorites")
      .withIndex("by_owner_target", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", user._id).eq("targetKey", key)
      )
      .unique();
    const blockedByFolder = favorite ? (await ancestors(ctx, favorite)).some((row) => row.deletedAt !== null) : false;
    return {
      favorite,
      isFavorite: !!favorite && favorite.deletedAt === null && !blockedByFolder,
      blockedByFolder,
      canFavorite: target.canFavorite,
    };
  },
});
