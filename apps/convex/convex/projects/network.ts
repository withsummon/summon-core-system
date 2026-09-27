import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalMutation } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
import { canAdministerProject } from "./administration";
import { grantProjectMembership } from "./index";
import { projectNetwork, type ProjectNetwork } from "./network_schema";
import { pageBudget } from "../commercial/validation";
// Temporary stored-data transition: existing native projects were membership-only.
// Backfill preserves that privacy, rather than silently disclosing them as public.
function storedNetwork(project: Doc<"projects">) {
  return project.network ?? 0;
}
async function scope(ctx: QueryCtx, projectId: Id<"projects">) {
  const project = await ctx.db.get(projectId);
  if (!project || project.archived || project.deletedAt != null) throw new ConvexError("Project not found.");
  const access = await requireWorkspace(ctx, project.workspaceId);
  const membership = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", access.user._id))
    .unique();
  return { ...access, project, membership };
}
function canDiscover(network: ProjectNetwork, role: string, joined: boolean) {
  return joined || role === "admin" || (role === "member" && network === 2);
}
function revision(project: Doc<"projects">, expected: number) {
  if (!Number.isSafeInteger(expected) || project.metadataRevision !== expected)
    throw new ConvexError("Project changed. Reload its current access settings.");
}
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const access = await scope(ctx, args.projectId);
    const network = storedNetwork(access.project);
    const joined = access.membership?.active === true;
    if (!canDiscover(network, access.member.role, joined)) throw new ConvexError("Project not found.");
    return {
      projectId: access.project._id,
      name: access.project.name,
      identifier: access.project.identifier,
      network,
      revision: access.project.metadataRevision,
      joined,
      canJoin: !joined && access.member.role !== "guest" && (network === 2 || access.member.role === "admin"),
      canManage: await canAdministerProject(ctx, access.project, access.user._id, access.member.role),
    };
  },
});
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId);
    const result = await ctx.db
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (project) => {
        if (project.archived || project.deletedAt != null) return null;
        const membership = await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", access.user._id))
          .unique();
        const joined = membership?.active === true;
        const network = storedNetwork(project);
        if (!canDiscover(network, access.member.role, joined)) return null;
        return {
          projectId: project._id,
          name: project.name,
          identifier: project.identifier,
          network,
          revision: project.metadataRevision,
          joined,
          canJoin: !joined && access.member.role !== "guest",
        };
      })
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
});
export const save = mutation({
  args: { projectId: v.id("projects"), network: projectNetwork, expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const access = await scope(ctx, args.projectId);
    if (!(await canAdministerProject(ctx, access.project, access.user._id, access.member.role)))
      throw new ConvexError("Only workspace or project administrators can change project access.");
    revision(access.project, args.expectedRevision);
    if (storedNetwork(access.project) === args.network) return;
    await ctx.db.patch(access.project._id, {
      network: args.network,
      metadataRevision: access.project.metadataRevision + 1,
    });
  },
});
export const join = mutation({
  args: { projectId: v.id("projects"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const access = await scope(ctx, args.projectId);
    if (access.member.role === "guest" || (storedNetwork(access.project) === 0 && access.member.role !== "admin"))
      throw new ConvexError("You cannot join this project.");
    revision(access.project, args.expectedRevision);
    return grantProjectMembership(ctx, {
      workspaceId: access.workspace._id,
      projectId: access.project._id,
      userId: access.user._id,
      role: access.membership?.role ?? access.member.role,
    });
  },
});
export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("projects")
      .paginate({ numItems: 50, cursor: args.cursor, maximumRowsRead: 100, maximumBytesRead: 1024 * 1024 });
    let changed = 0;
    for (const project of page.page)
      if (project.network === undefined) {
        await ctx.db.patch(project._id, { network: 0 });
        changed++;
      }
    return { cursor: page.continueCursor, isDone: page.isDone, processed: page.page.length, changed };
  },
});
