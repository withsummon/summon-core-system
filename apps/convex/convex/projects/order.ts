import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { ConvexError, v } from "convex/values";
import schema from "../schema";
import { internalMutation, mutation, query } from "../_generated/server";
import { requireProject, requireWorkspace } from "../identity/access";
import {
  initializeProjectOrder,
  projectUserProperty,
  visibleOrderedProject,
  requireDistinctOrder,
  nearestProjectOrder,
} from "./order_owner";
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user, member } = await requireWorkspace(ctx, args.workspaceId);
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    )
      throw new ConvexError("Request between 1 and 100 projects.");
    return stream(ctx.db, schema)
      .query("projectUserProperties")
      .withIndex("by_owner_order", (q) => q.eq("workspaceId", args.workspaceId).eq("userId", user._id))
      .map(async (row) => {
        const visible = await visibleOrderedProject(ctx, row);
        return visible
          ? Object.assign(visible.project, {
              membershipRole: visible.member.role,
              workspaceRole: member.role,
              orderRevision: row.revision,
            })
          : null;
      })
      .paginate({ ...args.paginationOpts, maximumRowsRead: 100, maximumBytesRead: 1048576 });
  },
});
export const move = mutation({
  args: {
    projectId: v.id("projects"),
    expectedRevision: v.number(),
    neighborId: v.id("projects"),
    expectedNeighborRevision: v.number(),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const { user, project } = await requireProject(ctx, args.projectId);
    const current = await projectUserProperty(ctx, project._id, user._id);
    if (!current) throw new ConvexError("Project ordering has not been initialized.");
    if (current.workspaceId !== project.workspaceId) throw new ConvexError("Project order scope is inconsistent.");
    await requireDistinctOrder(ctx, current);
    if (current.revision !== args.expectedRevision)
      throw new ConvexError("Project order changed. Reload before moving.");
    const neighbor = await nearestProjectOrder(ctx, current, args.direction === "up");
    if (neighbor.projectId !== args.neighborId || neighbor.revision !== args.expectedNeighborRevision)
      throw new ConvexError("Neighboring project changed. Reload before moving.");
    await requireDistinctOrder(ctx, neighbor);
    await ctx.db.patch(current._id, { sortOrder: neighbor.sortOrder, revision: current.revision + 1 });
    await ctx.db.patch(neighbor._id, { sortOrder: current.sortOrder, revision: neighbor.revision + 1 });
  },
});
// Missing-row rollout owner. Verify complete coverage before activating an
// ordered consumer on each deployment; creation and grants initialize new rows.
export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("projectMembers")
      .paginate({ cursor: args.cursor, numItems: 50, maximumRowsRead: 50, maximumBytesRead: 1048576 });
    let changed = 0;
    // Each initialization reads the preceding insert to allocate a unique top position.
    /* oxlint-disable no-await-in-loop */
    for (const member of page.page) {
      const project = await ctx.db.get(member.projectId);
      if (!project || project.workspaceId !== member.workspaceId)
        throw new ConvexError("Project membership scope is inconsistent.");
      if (
        await initializeProjectOrder(ctx, {
          workspaceId: member.workspaceId,
          projectId: member.projectId,
          userId: member.userId,
        })
      )
        changed++;
    }
    /* oxlint-enable no-await-in-loop */
    return { processed: page.page.length, changed, continueCursor: page.continueCursor, isDone: page.isDone };
  },
});
