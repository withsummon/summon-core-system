import { ConvexError, v } from "convex/values";
import { query, mutation, internalMutation } from "../_generated/server";
import { requireProject, requireWorkspace } from "../identity/access";
import { renderedProjectLogo } from "./branding_schema";
import { projectFeatures, defaultProjectFeatures } from "./feature_schema";
import { ensureDefaultIntake } from "../intakes/configuration_owner";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
function stored(project: Doc<"projects">) {
  if (!project.features) throw new ConvexError("Project feature migration is required.");
  return { ...project.features, intake: project.intakeEnabled ?? false };
}
async function featureAccess(ctx: QueryCtx, projectId: Id<"projects">, write = false) {
  const project = await ctx.db.get(projectId);
  if (!project || project.deletedAt != null || project.archived) throw new ConvexError("Project is unavailable.");
  const { member, user } = await requireWorkspace(ctx, project.workspaceId);
  if (write && member.role === "admin") return { project, user, role: member.role, canConfigure: true };
  const { projectMember } = await requireProject(ctx, projectId);
  const projectRole = member.role === "admin" ? "admin" : projectMember.role;
  const role = member.role === "guest" ? "guest" : projectRole;
  return { project, user, role, canConfigure: role === "admin" };
}
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const { project, canConfigure } = await featureAccess(ctx, projectId);
    return {
      features: stored(project),
      revision: project.metadataRevision,
      canConfigure,
    };
  },
});
export const resolve = query({
  args: { workspaceId: v.id("workspaces"), projectId: v.string() },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    const projectId = ctx.db.normalizeId("projects", args.projectId);
    if (!projectId) throw new ConvexError("Project is unavailable.");
    const { project, role, canConfigure } = await featureAccess(ctx, projectId);
    if (project.workspaceId !== args.workspaceId) throw new ConvexError("Project is unavailable.");
    return {
      projectId: project._id,
      name: project.name,
      logo: renderedProjectLogo(project.logoProps ?? {}),
      role,
      features: stored(project),
      revision: project.metadataRevision,
      canConfigure,
    };
  },
});
export const save = mutation({
  args: { projectId: v.id("projects"), expectedRevision: v.number(), features: projectFeatures, intake: v.boolean() },
  handler: async (ctx, args) => {
    const { project, canConfigure, user } = await featureAccess(ctx, args.projectId, true);
    if (!canConfigure) throw new ConvexError("Only workspace or project administrators can configure features.");
    stored(project);
    if (!Number.isSafeInteger(args.expectedRevision) || project.metadataRevision !== args.expectedRevision)
      throw new ConvexError("Project settings changed. Refresh before saving.");
    if (args.intake) await ensureDefaultIntake(ctx, project);
    await ctx.db.patch(project._id, {
      features: args.features,
      intakeEnabled: args.intake,
      metadataRevision: project.metadataRevision + 1,
      updatedAt: Date.now(),
      updatedById: user._id,
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
