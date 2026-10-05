import { defaultTaskPreferences, taskDisplayFilters, taskDisplayFiltersSchema, viewFilters } from "../tasks/schema";
import { setViewFavorite } from "../favorites/views";
import { effectiveFavorite } from "../favorites/access";
import { resultPage } from "./result_page";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { query, mutation } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
import { pageBudget, text } from "../commercial/validation";
import { viewDefinitionFields } from "./schema";
import { validatedProjectLogo } from "../projects/branding_schema";
import { workspaceCapabilities, requireWorkspaceView, requireRevision, workspaceView } from "./access";
import { validateWorkspaceFilters, workspaceFilterSelections } from "./filters";
export const create = mutation({
  args: { workspaceId: v.id("workspaces"), ...viewDefinitionFields },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    const filters = await validateWorkspaceFilters(ctx, args.workspaceId, user._id, args.filters);
    const display = taskDisplayFiltersSchema.safeParse(args.displayFilters ?? defaultTaskPreferences.displayFilters);
    if (!display.success) throw new ConvexError(display.error.message);
    const name = text(args.name, "View name", 255, true);
    return ctx.db.insert("savedViews", {
      projectId: null,
      workspaceId: args.workspaceId,
      ownerId: user._id,
      name,
      nameFolded: name.toLowerCase(),
      description: text(args.description, "View description", 10000),
      filters,
      displayFilters: display.data,
      displayProperties: args.displayProperties ?? defaultTaskPreferences.displayProperties,
      access: args.access ?? "public",
      logoProps: validatedProjectLogo(args.logoProps ?? {}),
      isLocked: false,
      updatedAt: Date.now(),
      deletedAt: null,
    });
  },
});
export const update = mutation({
  args: { viewId: v.id("savedViews"), expectedUpdatedAt: v.number(), ...viewDefinitionFields },
  handler: async (ctx, args) => {
    const { view, canEdit, access: permission } = await requireWorkspaceView(ctx, args.viewId);
    if (!canEdit) throw new ConvexError("Only the owner can edit an unlocked saved view.");
    requireRevision(view, args.expectedUpdatedAt);
    const filters = await validateWorkspaceFilters(ctx, view.workspaceId, permission.user._id, args.filters);
    const display =
      args.displayFilters === undefined ? undefined : taskDisplayFiltersSchema.safeParse(args.displayFilters);
    if (display && !display.success) throw new ConvexError(display.error.message);
    const name = text(args.name, "View name", 255, true);
    await ctx.db.patch(view._id, {
      name,
      nameFolded: name.toLowerCase(),
      description: text(args.description, "View description", 10000),
      filters,
      ...(display === undefined ? {} : { displayFilters: display.data }),
      ...(args.displayProperties === undefined ? {} : { displayProperties: args.displayProperties }),
      ...(args.access === undefined ? {} : { access: args.access }),
      ...(args.logoProps === undefined ? {} : { logoProps: validatedProjectLogo(args.logoProps) }),
      updatedAt: Math.max(Date.now(), view.updatedAt + 1),
    });
  },
});
async function detail(ctx: QueryCtx, viewId: Id<"savedViews">) {
  const { view, access: permission } = await requireWorkspaceView(ctx, viewId, true);
  return {
    ...(await workspaceView(ctx, view, permission)),
    selections: await workspaceFilterSelections(ctx, view, permission.user._id, permission.member.role),
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
  args: {
    workspaceId: v.id("workspaces"),
    deleted: v.boolean(),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const permission = await requireWorkspace(ctx, args.workspaceId);
    const search = args.search?.toLowerCase() ?? "";
    return stream(ctx.db, schema)
      .query("savedViews")
      .withIndex("by_workspace_project_deleted", (q) =>
        args.deleted
          ? q.eq("workspaceId", args.workspaceId).eq("projectId", null).gt("deletedAt", null)
          : q.eq("workspaceId", args.workspaceId).eq("projectId", null).eq("deletedAt", null)
      )
      .order("desc")
      .map(async (view) =>
        workspaceCapabilities(view, permission).canRead && view.name.toLowerCase().includes(search)
          ? workspaceView(ctx, view, permission)
          : null
      )
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const lifecycle = mutation({
  args: { viewId: v.id("savedViews"), expectedUpdatedAt: v.number(), deleted: v.boolean() },
  handler: async (ctx, args) => {
    const { view, canRemove, canRestore } = await requireWorkspaceView(ctx, args.viewId, true, "lifecycle");
    requireRevision(view, args.expectedUpdatedAt);
    if (args.deleted ? !canRemove : !canRestore)
      throw new ConvexError("Only the owner or a workspace administrator can change this saved view's lifecycle.");
    await ctx.db.patch(view._id, {
      deletedAt: args.deleted ? Date.now() : null,
      updatedAt: Math.max(Date.now(), view.updatedAt + 1),
    });
  },
});

export const favorite = mutation({
  args: { viewId: v.id("savedViews"), favorite: v.boolean() },
  handler: async (ctx, args) => {
    const { view, access: permission, canFavorite } = await requireWorkspaceView(ctx, args.viewId);
    if (!canFavorite) throw new ConvexError("Guests cannot change favorites.");
    await setViewFavorite(ctx, view, permission.user._id, args.favorite);
  },
});
export const favorites = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const permission = await requireWorkspace(ctx, args.workspaceId);
    return stream(ctx.db, schema)
      .query("favorites")
      .withIndex("by_owner_type_project", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("userId", permission.user._id)
          .eq("targetType", "view")
          .eq("targetProjectId", null)
      )
      .order("desc")
      .map(async (row) => {
        if (row.target.type !== "view" || !(await effectiveFavorite(ctx, row))) return null;
        const view = await ctx.db.get(row.target.id);
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
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const results = query({
  args: {
    viewId: v.id("savedViews"),
    filters: v.optional(viewFilters),
    displayFilters: v.optional(taskDisplayFilters),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { view, access: permission } = await requireWorkspaceView(ctx, args.viewId);
    const filters =
      args.filters === undefined
        ? view.filters
        : await validateWorkspaceFilters(ctx, view.workspaceId, permission.user._id, args.filters);
    const display =
      args.displayFilters === undefined ? undefined : taskDisplayFiltersSchema.safeParse(args.displayFilters);
    if (display && !display.success) throw new ConvexError(display.error.message);
    return resultPage(ctx, view, permission, args.paginationOpts, {
      filters,
      displayFilters: display?.data ?? view.displayFilters,
    });
  },
});
