import { ConvexError, v } from "convex/values";
import { query, mutation, internalMutation } from "../_generated/server";
import { requireProject, requireWorkspace } from "../identity/access";
import { canAdministerProject } from "./administration";
import { projectFeatures, defaultProjectFeatures } from "./feature_schema";
import { ensureDefaultIntake } from "../intakes/configuration_owner";
import type { Doc } from "../_generated/dataModel";
function stored(project: Doc<"projects">) {
  if (!project.features) throw new ConvexError("Project feature migration is required.");
  return { ...project.features, intake: project.intakeEnabled ?? false };
}
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get(projectId);
    if (!project || project.deletedAt != null || project.archived) throw new ConvexError("Project is unavailable.");
    const { user, member } = await requireWorkspace(ctx, project.workspaceId);
    if (member.role !== "admin") await requireProject(ctx, projectId);
    return {
      features: stored(project),
      revision: project.metadataRevision,
      canConfigure: await canAdministerProject(ctx, project, user._id, member.role),
    };
  },
});
export const save = mutation({
  args: { projectId: v.id("projects"), expectedRevision: v.number(), features: projectFeatures, intake: v.boolean() },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project || project.deletedAt != null || project.archived) throw new ConvexError("Project is unavailable.");
    const { user, member } = await requireWorkspace(ctx, project.workspaceId);
    if (!(await canAdministerProject(ctx, project, user._id, member.role)))
      throw new ConvexError("Only workspace or project administrators can configure features.");
    stored(project);
    if (!Number.isSafeInteger(args.expectedRevision) || project.metadataRevision !== args.expectedRevision)
      throw new ConvexError("Project settings changed. Refresh before saving.");
    if (args.intake) await ensureDefaultIntake(ctx, project);
    await ctx.db.patch(project._id, {
      features: args.features,
      intakeEnabled: args.intake,
      metadataRevision: project.metadataRevision + 1,
    });
  },
});
export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const result = await ctx.db
      .query("projects")
      .paginate({ cursor, numItems: 100, maximumRowsRead: 100, maximumBytesRead: 1048576 });
    let changed = 0;
    for (const project of result.page)
      if (!project.features) {
        // oxlint-disable-next-line no-await-in-loop
        await ctx.db.patch(project._id, { features: defaultProjectFeatures });
        changed++;
      }
    return { processed: result.page.length, changed, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});
