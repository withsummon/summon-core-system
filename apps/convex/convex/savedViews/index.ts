import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { query, mutation } from "../_generated/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { pageBudget, text } from "../commercial/validation";
import { viewDefinitionFields } from "./schema";
import { validatedProjectLogo } from "../projects/branding_schema";
import { capabilities, requireView, requireRevision, projectView } from "./access";
import { validateFilters, filterSelections } from "./filters";
export const create = mutation({
  args: { projectId: v.id("projects"), ...viewDefinitionFields },
  handler: async (ctx, args) => {
    const { user, project } = await requireProject(ctx, args.projectId);
    const filters = await validateFilters(ctx, args.projectId, args.filters);
    return ctx.db.insert("savedViews", {
      projectId: args.projectId,
      workspaceId: project.workspaceId,
      ownerId: user._id,
      name: text(args.name, "View name", 255, true),
      description: text(args.description, "View description", 10000),
      filters,
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
    const { view, canEdit } = await requireView(ctx, args.viewId);
    if (!canEdit) throw new ConvexError("Only the owner can edit an unlocked saved view.");
    requireRevision(view, args.expectedUpdatedAt);
    const filters = await validateFilters(ctx, view.projectId, args.filters);
    await ctx.db.patch(view._id, {
      name: text(args.name, "View name", 255, true),
      description: text(args.description, "View description", 10000),
      filters,
      ...(args.access === undefined ? {} : { access: args.access }),
      ...(args.logoProps === undefined ? {} : { logoProps: validatedProjectLogo(args.logoProps) }),
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
    return stream(ctx.db, schema)
      .query("savedViews")
      .withIndex("by_project_deleted", (q) =>
        args.deleted
          ? q.eq("projectId", args.projectId).gt("deletedAt", null)
          : q.eq("projectId", args.projectId).eq("deletedAt", null)
      )
      .order("desc")
      .map(async (view) => (capabilities(view, access).canRead ? projectView(ctx, view, access) : null))
      .paginate(pageBudget(args.paginationOpts));
  },
});
export async function changeViewDeleted(ctx: MutationCtx, view: Doc<"savedViews">, deleted: boolean) {
  const updatedAt = Math.max(Date.now(), view.updatedAt + 1);
  await ctx.db.patch(view._id, { deletedAt: deleted ? updatedAt : null, updatedAt });
}
export const lifecycle = mutation({
  args: { viewId: v.id("savedViews"), expectedUpdatedAt: v.number(), deleted: v.boolean() },
  handler: async (ctx, args) => {
    const { view, canRemove, canRestore } = await requireView(ctx, args.viewId, true, "lifecycle");
    requireRevision(view, args.expectedUpdatedAt);
    if (args.deleted ? !canRemove : !canRestore)
      throw new ConvexError("Only the owner or a project administrator can change this saved view's lifecycle.");
    await changeViewDeleted(ctx, view, args.deleted);
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
