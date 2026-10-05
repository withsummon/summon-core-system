import { taskAssigneeEligible } from "../tasks/properties";
import { validateProjectMetadata, validateProjectLead } from "./metadata_fields";
import { canAdministerProject } from "./administration";
import { requireNetworkScope } from "./network_access";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalMutation } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { changeFavoriteDeleted } from "../favorites/write";
import { requireProject, requireWorkspace } from "../identity/access";

export function projectMetadata(project: Doc<"projects">) {
  return { description: project.description, revision: project.metadataRevision };
}
export function checkRevision(project: Doc<"projects">, expectedRevision: number) {
  const metadata = projectMetadata(project);
  if (!Number.isSafeInteger(expectedRevision) || metadata.revision !== expectedRevision)
    throw new ConvexError("Project changed. Reopen settings before saving.");
  return metadata.revision + 1;
}
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    return {
      ...projectMetadata(access.project),
      name: access.project.name,
      identifier: access.project.identifier,
      canManage: access.member.role !== "guest" && access.projectMember.role === "admin",
      canDelete: await canAdministerProject(ctx, access.project, access.user._id, access.member.role),
    };
  },
});
export const save = mutation({
  args: { projectId: v.id("projects"), name: v.string(), description: v.string(), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { project, projectMember, user } = await requireProject(ctx, args.projectId, true);
    if (projectMember.role !== "admin") throw new ConvexError("Only project administrators can edit project settings.");
    const metadataRevision = checkRevision(project, args.expectedRevision);
    const fields = await validateProjectMetadata(
      ctx,
      project.workspaceId,
      { ...args, identifier: project.identifier },
      project._id
    );
    await ctx.db.patch(project._id, { ...fields, metadataRevision, updatedAt: Date.now(), updatedById: user._id });
  },
});
export const archived = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user, member } = await requireWorkspace(ctx, args.workspaceId);
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 50
    )
      throw new ConvexError("Page size must be an integer between 1 and 50.");
    const candidates = await ctx.db
      .query("projectMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.workspaceId).eq("userId", user._id))
      .paginate({
        ...args.paginationOpts,
        maximumRowsRead: 50,
        maximumBytesRead: 1048576,
      });
    const rows = await Promise.all(
      candidates.page.map(async (membership) => {
        if (!membership.active) return null;
        const project = await ctx.db.get(membership.projectId);
        if (!project?.archived || project.deletedAt != null) return null;
        return {
          _id: project._id,
          name: project.name,
          identifier: project.identifier,
          revision: projectMetadata(project).revision,
          canRestore: member.role !== "guest" && membership.role === "admin",
          canDelete: await canAdministerProject(ctx, project, user._id, member.role),
        };
      })
    );
    return { ...candidates, page: rows.filter((row) => row !== null) };
  },
});
export const setArchived = mutation({
  args: { projectId: v.id("projects"), archived: v.boolean(), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    // This owner permits lifecycle recovery only; normal domain access still rejects archived projects.
    const { project, user, member } = await requireNetworkScope(ctx, args.projectId, true);
    if (!(await canAdministerProject(ctx, project, user._id, member.role)))
      throw new ConvexError("Only workspace or project administrators can archive or restore projects.");
    if (project.archived === args.archived) {
      checkRevision(project, args.expectedRevision);
      return;
    }
    await writeProjectArchived(ctx, { project, user }, args.expectedRevision, args.archived);
  },
});

// UI and REST authorize independently; this transaction owns their common effects.
export async function writeProjectArchived(
  ctx: MutationCtx,
  { project, user }: Pick<Awaited<ReturnType<typeof requireNetworkScope>>, "project" | "user">,
  expectedRevision: number,
  isArchived: boolean
) {
  const metadataRevision = checkRevision(project, expectedRevision);
  const updatedAt = Date.now();
  await ctx.db.patch(project._id, {
    archived: isArchived,
    archivedAt: isArchived ? updatedAt : null,
    metadataRevision,
    updatedAt,
    updatedById: user._id,
    ...(isArchived ? { archivedFavoriteRevision: metadataRevision } : {}),
  });
  if (!isArchived) return;
  await ctx.scheduler.runAfter(0, internal.projects.settings.archiveFavorites, {
    projectId: project._id,
    workspaceId: project.workspaceId,
    archiveRevision: metadataRevision,
    cursor: null,
  });
}
export const archiveFavorites = internalMutation({
  args: {
    projectId: v.id("projects"),
    workspaceId: v.id("workspaces"),
    archiveRevision: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (
      !project ||
      project.workspaceId !== args.workspaceId ||
      project.archivedFavoriteRevision === undefined ||
      project.archivedFavoriteRevision < args.archiveRevision
    )
      throw new Error("Archive favorite scope or revision changed.");
    const rows = await ctx.db
      .query("favorites")
      .withIndex("by_project_type_deleted", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("targetProjectId", args.projectId)
      )
      .paginate({ cursor: args.cursor, numItems: 50, maximumRowsRead: 50, maximumBytesRead: 1048576 });
    await Promise.all(
      rows.page.map(async (row) => {
        if (row.deletedAt === null && (row.projectRevision === undefined || row.projectRevision < args.archiveRevision))
          await changeFavoriteDeleted(ctx, row, true);
      })
    );
    if (!rows.isDone)
      await ctx.scheduler.runAfter(0, internal.projects.settings.archiveFavorites, {
        ...args,
        cursor: rows.continueCursor,
      });
  },
});

export const memberDefaults = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    const canManage = await canAdministerProject(ctx, access.project, access.user._id, access.member.role);
    return {
      projectId: access.project._id,
      name: access.project.name,
      canManage,
      revision: access.project.metadataRevision,
      leadId: access.project.leadId ?? null,
      defaultAssigneeId: access.project.defaultAssigneeId,
      defaultAssigneeEligible:
        access.project.defaultAssigneeId !== null &&
        (await taskAssigneeEligible(ctx, access.project, access.project.defaultAssigneeId)),
      guestViewAllFeatures: access.project.guestViewAllFeatures ?? false,
    };
  },
});
export const saveMemberDefaults = mutation({
  args: {
    projectId: v.id("projects"),
    expectedRevision: v.number(),
    leadId: v.optional(v.union(v.id("users"), v.null())),
    defaultAssigneeId: v.optional(v.union(v.id("users"), v.null())),
    guestViewAllFeatures: v.optional(v.boolean()),
  },
  handler: async (ctx, { expectedRevision, projectId, ...fields }) => {
    const { project, user, member } = await requireProject(ctx, projectId);
    if (!(await canAdministerProject(ctx, project, user._id, member.role)))
      throw new ConvexError("Only workspace or project administrators can edit project member defaults.");
    const metadataRevision = checkRevision(project, expectedRevision);
    if (fields.leadId !== undefined && fields.leadId !== (project.leadId ?? null))
      await validateProjectLead(ctx, project.workspaceId, fields.leadId);
    if (
      fields.defaultAssigneeId !== undefined &&
      fields.defaultAssigneeId !== null &&
      !(await taskAssigneeEligible(ctx, project, fields.defaultAssigneeId))
    )
      throw new ConvexError("Default assignee must be an active project writer.");
    await ctx.db.patch(projectId, { ...fields, metadataRevision, updatedAt: Date.now(), updatedById: user._id });
    return { revision: metadataRevision };
  },
});
