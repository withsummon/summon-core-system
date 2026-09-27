import { resultPage } from "./result_page";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
import { pageBudget, text } from "../commercial/validation";
import { viewFilters } from "./schema";
import { workspaceCapabilities, requireWorkspaceView, requireRevision, workspaceView } from "./access";
import { validateWorkspaceFilters, workspaceFilterSelections } from "./filters";
const definition = { name: v.string(), description: v.string(), filters: viewFilters };
export const create = mutation({
  args: { workspaceId: v.id("workspaces"), ...definition },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    const filters = await validateWorkspaceFilters(ctx, args.workspaceId, user._id, args.filters);
    return ctx.db.insert("savedViews", {
      projectId: null,
      workspaceId: args.workspaceId,
      ownerId: user._id,
      name: text(args.name, "View name", 255, true),
      description: text(args.description, "View description", 10000),
      filters,
      isLocked: false,
      updatedAt: Date.now(),
      deletedAt: null,
    });
  },
});
export const update = mutation({
  args: { viewId: v.id("savedViews"), expectedUpdatedAt: v.number(), ...definition },
  handler: async (ctx, args) => {
    const { view, canEdit, access: permission } = await requireWorkspaceView(ctx, args.viewId);
    if (!canEdit) throw new ConvexError("Only the owner can edit an unlocked saved view.");
    requireRevision(view, args.expectedUpdatedAt);
    const filters = await validateWorkspaceFilters(ctx, view.workspaceId, permission.user._id, args.filters);
    await ctx.db.patch(view._id, {
      name: text(args.name, "View name", 255, true),
      description: text(args.description, "View description", 10000),
      filters,
      updatedAt: Math.max(Date.now(), view.updatedAt + 1),
    });
  },
});
async function detail(ctx: QueryCtx, viewId: Id<"savedViews">) {
  const { view, access: permission } = await requireWorkspaceView(ctx, viewId, true);
  return {
    ...(await workspaceView(ctx, view, permission)),
    selections: await workspaceFilterSelections(ctx, view, permission.user._id),
  };
}
export const get = query({
  args: { viewId: v.id("savedViews") },
  handler: async (ctx, args) => detail(ctx, args.viewId),
});
export const resolve = query({
  args: { viewId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("savedViews", args.viewId);
    if (!id) throw new ConvexError("Saved view not found.");
    return detail(ctx, id);
  },
});
export const list = query({
  args: { workspaceId: v.id("workspaces"), deleted: v.boolean(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const permission = await requireWorkspace(ctx, args.workspaceId);
    const source = ctx.db
      .query("savedViews")
      .withIndex("by_workspace_project_deleted", (q) =>
        args.deleted
          ? q.eq("workspaceId", args.workspaceId).eq("projectId", null).gt("deletedAt", null)
          : q.eq("workspaceId", args.workspaceId).eq("projectId", null).eq("deletedAt", null)
      );
    const result = await source.order("desc").paginate(pageBudget(args.paginationOpts));
    const rows = result.page.filter((view) => workspaceCapabilities(view, permission).canRead);
    return { ...result, page: await Promise.all(rows.map((view) => workspaceView(ctx, view, permission))) };
  },
});
export const lifecycle = mutation({
  args: { viewId: v.id("savedViews"), expectedUpdatedAt: v.number(), deleted: v.boolean() },
  handler: async (ctx, args) => {
    const { view, canRemove, canRestore } = await requireWorkspaceView(ctx, args.viewId, true);
    requireRevision(view, args.expectedUpdatedAt);
    if (args.deleted ? !canRemove : !canRestore)
      throw new ConvexError("Only the owner or a workspace administrator can change this saved view's lifecycle.");
    await ctx.db.patch(view._id, {
      deletedAt: args.deleted ? Date.now() : null,
      updatedAt: Math.max(Date.now(), view.updatedAt + 1),
    });
  },
});

export const access = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const permission = await requireWorkspace(ctx, args.workspaceId);
    return {
      canCreate: true,
      canFavorite: permission.member.role !== "guest",
    };
  },
});
export const favorite = mutation({
  args: { viewId: v.id("savedViews"), favorite: v.boolean() },
  handler: async (ctx, args) => {
    const { view, access: permission, canFavorite } = await requireWorkspaceView(ctx, args.viewId);
    if (!canFavorite) throw new ConvexError("Guests cannot change favorites.");
    const existing = await ctx.db
      .query("savedViewFavorites")
      .withIndex("by_view_user", (q) => q.eq("viewId", view._id).eq("userId", permission.user._id))
      .unique();
    if (args.favorite && !existing)
      await ctx.db.insert("savedViewFavorites", {
        viewId: view._id,
        projectId: null,
        workspaceId: view.workspaceId,
        userId: permission.user._id,
      });
    if (!args.favorite && existing) await ctx.db.delete(existing._id);
  },
});
export const favorites = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const permission = await requireWorkspace(ctx, args.workspaceId);
    const result = await ctx.db
      .query("savedViewFavorites")
      .withIndex("by_workspace_project_user", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("projectId", null).eq("userId", permission.user._id)
      )
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (row) => {
        const view = await ctx.db.get(row.viewId);
        if (
          !view ||
          view.projectId !== null ||
          view.workspaceId !== args.workspaceId ||
          view.deletedAt !== null ||
          !workspaceCapabilities(view, permission).canRead
        )
          return null;
        return workspaceView(ctx, view, permission);
      })
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
});
export const results = query({
  args: { viewId: v.id("savedViews"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { view, access: permission } = await requireWorkspaceView(ctx, args.viewId);
    return resultPage(
      ctx,
      view,
      view.workspaceId,
      permission.user._id,
      permission.member.role === "guest",
      args.paginationOpts
    );
  },
});
