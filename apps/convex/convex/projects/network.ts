import { renderedProjectLogo } from "./branding_schema";
import { projectCover } from "./cover_owner";
import { storedNetwork, requireNetworkScope, canDiscover } from "./network_access";
import { effectiveFavorite } from "../favorites/access";
import { projectUserProperty } from "./order_owner";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { query, mutation, internalMutation } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
import { canAdministerProject } from "./administration";
import { grantProjectMembership } from "./index";
import { projectNetwork } from "./network_schema";
import { pageBudget } from "../commercial/validation";
function revision(project: Doc<"projects">, expected: number) {
  if (!Number.isSafeInteger(expected) || project.metadataRevision !== expected)
    throw new ConvexError("Project changed. Reload its current access settings.");
}
async function directoryProject(ctx: QueryCtx, access: Awaited<ReturnType<typeof requireNetworkScope>>) {
  const { project, membership, member, user } = access;
  const joined = membership?.active === true;
  const canAdminister = await canAdministerProject(ctx, project, user._id, member.role);
  const canArchive = member.role !== "guest" && joined && membership.role === "admin";
  const network = storedNetwork(project);
  const favorite = await ctx.db
    .query("favorites")
    .withIndex("by_owner_target", (q) =>
      q.eq("workspaceId", project.workspaceId).eq("userId", user._id).eq("targetKey", `project:${project._id}`)
    )
    .unique();
  const order = await projectUserProperty(ctx, project._id, user._id);
  const logoProps = project.logoProps ?? {};
  const appearance = await projectCover(ctx, project._id);
  return {
    projectId: project._id,
    name: project.name,
    identifier: project.identifier,
    description: project.description,
    logoProps,
    logo: renderedProjectLogo(logoProps),
    createdAt: project._creationTime,
    network,
    revision: project.metadataRevision,
    joined,
    archived: project.archived,
    memberRole: joined ? membership.role : null,
    isFavorite: joined && (await effectiveFavorite(ctx, favorite)),
    cover: appearance.cover,
    externalCoverUrl: appearance.cover ? null : appearance.externalCoverUrl,
    personalOrder: order ? { sortOrder: order.sortOrder, revision: order.revision } : null,
    canJoin: !project.archived && !joined && member.role !== "guest",
    canFavorite: joined && member.role !== "guest" && !project.archived,
    canRestore: project.archived && canArchive,
    canArchive: !project.archived && canArchive,
    canDelete: canAdminister,
    canOpenSettings: joined && membership?.role !== "guest" && !project.archived,
    canManage: !project.archived && canAdminister,
  };
}
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const access = await requireNetworkScope(ctx, args.projectId, true);
    const network = storedNetwork(access.project);
    const joined = access.membership?.active === true;
    if (!canDiscover(network, access.member.role, joined)) throw new ConvexError("Project not found.");
    return directoryProject(ctx, access);
  },
});
export const list = query({
  args: { workspaceId: v.id("workspaces"), archived: v.optional(v.boolean()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId);
    return stream(ctx.db, schema)
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .map(async (project) => {
        if (project.archived !== (args.archived ?? false) || project.deletedAt != null) return null;
        const membership = await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", access.user._id))
          .unique();
        const joined = membership?.active === true;
        const network = storedNetwork(project);
        if (!canDiscover(network, access.member.role, joined)) return null;
        return directoryProject(ctx, { ...access, project, membership });
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const save = mutation({
  args: { projectId: v.id("projects"), network: projectNetwork, expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const access = await requireNetworkScope(ctx, args.projectId);
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
async function prepareJoin(ctx: QueryCtx, projectId: Id<"projects">, expectedRevision: number) {
  const access = await requireNetworkScope(ctx, projectId);
  if (access.member.role === "guest" || (storedNetwork(access.project) === 0 && access.member.role !== "admin"))
    throw new ConvexError("You cannot join this project.");
  revision(access.project, expectedRevision);
  return {
    workspaceId: access.workspace._id,
    projectId: access.project._id,
    userId: access.user._id,
    role: access.membership?.role ?? access.member.role,
  };
}
export const join = mutation({
  args: { projectId: v.id("projects"), expectedRevision: v.number() },
  handler: async (ctx, args) =>
    grantProjectMembership(ctx, await prepareJoin(ctx, args.projectId, args.expectedRevision)),
});
const MAX_JOIN_PROJECTS = 20;
export const joinMany = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    projects: v.array(v.object({ projectId: v.id("projects"), expectedRevision: v.number() })),
  },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId, true);
    if (!args.projects.length || args.projects.length > MAX_JOIN_PROJECTS)
      throw new ConvexError(`Select between 1 and ${MAX_JOIN_PROJECTS} projects.`);
    if (new Set(args.projects.map((row) => row.projectId)).size !== args.projects.length)
      throw new ConvexError("Select each project once.");
    const changes = await Promise.all(
      args.projects.map(async (row) => {
        const change = await prepareJoin(ctx, row.projectId, row.expectedRevision);
        if (change.workspaceId !== args.workspaceId)
          throw new ConvexError("Projects must belong to the selected workspace.");
        return change;
      })
    );
    for (const change of changes) {
      // Sequential initialization preserves distinct personal order positions in this atomic transaction.
      // eslint-disable-next-line no-await-in-loop
      await grantProjectMembership(ctx, change);
    }
    return { joinedProjectIds: changes.map((change) => change.projectId) };
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
