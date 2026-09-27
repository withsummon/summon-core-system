import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalMutation } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireProject, requireProjectMembership, requireWorkspace } from "../identity/access";

export function projectMetadata(project: Doc<"projects">) {
  if (project.description === undefined || project.metadataRevision === undefined)
    throw new ConvexError("Project metadata migration is required.");
  return { description: project.description, revision: project.metadataRevision };
}
function checkRevision(project: Doc<"projects">, expectedRevision: number) {
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
    };
  },
});
export const save = mutation({
  args: { projectId: v.id("projects"), name: v.string(), description: v.string(), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { project, projectMember } = await requireProject(ctx, args.projectId, true);
    if (projectMember.role !== "admin") throw new ConvexError("Only project administrators can edit project settings.");
    const metadataRevision = checkRevision(project, args.expectedRevision);
    const name = args.name.trim();
    if (!name || name.length > 120) throw new ConvexError("Enter a project name of up to 120 characters.");
    if (args.description.length > 20000) throw new ConvexError("Description must contain at most 20,000 characters.");
    await ctx.db.patch(project._id, { name, description: args.description, metadataRevision });
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
        if (!project?.archived) return null;
        return {
          _id: project._id,
          name: project.name,
          identifier: project.identifier,
          revision: projectMetadata(project).revision,
          canRestore: member.role !== "guest" && membership.role === "admin",
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
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new ConvexError("Project not found.");
    const { projectMember } = await requireProjectMembership(ctx, project, true);
    if (projectMember.role !== "admin")
      throw new ConvexError("Only project administrators can archive or restore projects.");
    const metadataRevision = checkRevision(project, args.expectedRevision);
    if (project.archived === args.archived) return;
    await ctx.db.patch(project._id, { archived: args.archived, metadataRevision });
  },
});
// Temporary: finish every cursor page and verify completion before requiring schema fields and removing this owner.
export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("projects")
      .paginate({ cursor: args.cursor, numItems: 50, maximumRowsRead: 50, maximumBytesRead: 1048576 });
    const pending = result.page.filter(
      (project) => project.description === undefined || project.metadataRevision === undefined
    );
    await Promise.all(
      pending.map((project) =>
        ctx.db.patch(project._id, {
          description: project.description ?? "",
          metadataRevision: project.metadataRevision ?? 0,
        })
      )
    );
    const changed = pending.length;
    return { changed, continueCursor: result.continueCursor, isDone: result.isDone };
  },
});
