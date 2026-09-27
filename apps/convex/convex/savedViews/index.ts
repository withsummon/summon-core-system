import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { pageBudget, text } from "../commercial/validation";
import { viewFilters } from "./schema";
import { capabilities, requireView, requireRevision, projectView } from "./access";
import { validateFilters, filterSelections } from "./filters";
const definition = { name: v.string(), description: v.string(), filters: viewFilters };
export const create = mutation({
  args: { projectId: v.id("projects"), ...definition },
  handler: async (ctx, args) => {
    const { user } = await requireProject(ctx, args.projectId);
    const filters = await validateFilters(ctx, args.projectId, args.filters);
    return ctx.db.insert("savedViews", {
      projectId: args.projectId,
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
    const { view, canEdit } = await requireView(ctx, args.viewId);
    if (!canEdit) throw new ConvexError("Only the owner can edit an unlocked saved view.");
    requireRevision(view, args.expectedUpdatedAt);
    const filters = await validateFilters(ctx, view.projectId, args.filters);
    await ctx.db.patch(view._id, {
      name: text(args.name, "View name", 255, true),
      description: text(args.description, "View description", 10000),
      filters,
      updatedAt: Math.max(Date.now(), view.updatedAt + 1),
    });
  },
});
async function detail(ctx: QueryCtx, viewId: Id<"savedViews">) {
  const { view, access } = await requireView(ctx, viewId, true);
  return { ...(await projectView(ctx, view, access)), selections: await filterSelections(ctx, view) };
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
  args: { projectId: v.id("projects"), deleted: v.boolean(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    const source = ctx.db
      .query("savedViews")
      .withIndex("by_project_deleted", (q) =>
        args.deleted
          ? q.eq("projectId", args.projectId).gt("deletedAt", null)
          : q.eq("projectId", args.projectId).eq("deletedAt", null)
      );
    const result = await source.order("desc").paginate(pageBudget(args.paginationOpts));
    const rows = result.page.filter((view) => capabilities(view, access).canRead);
    return { ...result, page: await Promise.all(rows.map((view) => projectView(ctx, view, access))) };
  },
});
export const lifecycle = mutation({
  args: { viewId: v.id("savedViews"), expectedUpdatedAt: v.number(), deleted: v.boolean() },
  handler: async (ctx, args) => {
    const { view, canRemove, canRestore } = await requireView(ctx, args.viewId, true);
    requireRevision(view, args.expectedUpdatedAt);
    if (args.deleted ? !canRemove : !canRestore)
      throw new ConvexError("Only the owner or a project administrator can change this saved view's lifecycle.");
    await ctx.db.patch(view._id, {
      deletedAt: args.deleted ? Date.now() : null,
      updatedAt: Math.max(Date.now(), view.updatedAt + 1),
    });
  },
});

export const access = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const permission = await requireProject(ctx, args.projectId);
    return {
      canCreate: true,
      canFavorite: permission.member.role !== "guest" && permission.projectMember.role !== "guest",
    };
  },
});
