import { canAdministerProject } from "./administration";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { query, mutation, internalMutation } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
import { pageBudget } from "../commercial/validation";

async function requireLifecycle(ctx: QueryCtx, projectId: Id<"projects">) {
  const project = await ctx.db.get(projectId);
  if (!project) throw new ConvexError("Project not found.");
  const access = await requireWorkspace(ctx, project.workspaceId);
  if (!(await canAdministerProject(ctx, project, access.user._id, access.member.role)))
    throw new ConvexError("Only workspace or project administrators can manage project Trash.");
  return project;
}
function projection(project: Doc<"projects">) {
  return {
    id: project._id,
    workspaceId: project.workspaceId,
    name: project.name,
    identifier: project.identifier,
    archived: project.archived,
    deletedAt: project.deletedAt ?? null,
    revision: project.metadataRevision,
  };
}
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => projection(await requireLifecycle(ctx, args.projectId)),
});
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId);
    return stream(ctx.db, schema)
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .map(async (project) =>
        project.deletedAt != null && (await canAdministerProject(ctx, project, access.user._id, access.member.role))
          ? projection(project)
          : null
      )
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const setDeleted = mutation({
  args: { projectId: v.id("projects"), deleted: v.boolean(), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const project = await requireLifecycle(ctx, args.projectId);
    if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision !== project.metadataRevision)
      throw new ConvexError("Project changed. Reopen its latest settings before continuing.");
    if ((project.deletedAt != null) === args.deleted) return;
    await ctx.db.patch(project._id, {
      deletedAt: args.deleted ? Date.now() : null,
      metadataRevision: project.metadataRevision + 1,
    });
  },
});
// Temporary additive rollout owner. Remove after both deployments complete every
// cursor page twice and the stored field is required. Missing means legacy active.
export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("projects")
      .paginate({ cursor: args.cursor, numItems: 50, maximumRowsRead: 50, maximumBytesRead: 1048576 });
    const changed = await Promise.all(
      page.page.map(async (project) => {
        if (project.deletedAt !== undefined) return 0;
        await ctx.db.patch(project._id, { deletedAt: null });
        return 1;
      })
    );
    return {
      processed: page.page.length,
      changed: changed.reduce<number>((sum, n) => sum + n, 0),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});
