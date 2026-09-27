import { ConvexError, v } from "convex/values";
import { internalMutation, query, mutation } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { workspaceTimezone, validateTimezone } from "../settings/timezone";
export function requireProjectTimezone(project: Doc<"projects">) {
  if (project.timezone === undefined)
    throw new ConvexError("Project timezone migration is required before scheduling cycles.");
  return project.timezone;
}
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { project, member, projectMember } = await requireProject(ctx, args.projectId);
    return {
      timezone: requireProjectTimezone(project),
      canManage: member.role !== "guest" && projectMember.role === "admin",
    };
  },
});
export const save = mutation({
  args: { projectId: v.id("projects"), timezone: v.string(), expectedTimezone: v.string() },
  handler: async (ctx, args) => {
    const { project, projectMember } = await requireProject(ctx, args.projectId, true);
    if (projectMember.role !== "admin") throw new ConvexError("Only project administrators can change timezone.");
    if (requireProjectTimezone(project) !== args.expectedTimezone)
      throw new ConvexError("Project timezone changed. Reload before saving.");
    await ctx.db.patch(project._id, { timezone: validateTimezone(args.timezone) });
  },
});
// Temporary migration owner. Run all cursor pages, verify remaining=0 separately,
// then make the stored schema field required and remove this mutation.
export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("projects")
      .paginate({ cursor: args.cursor, numItems: 50, maximumRowsRead: 50, maximumBytesRead: 1_048_576 });
    const changed = await Promise.all(
      result.page.map(async (project) => {
        if (project.timezone !== undefined) return 0;
        await ctx.db.patch(project._id, { timezone: await workspaceTimezone(ctx, project.workspaceId) });
        return 1;
      })
    );
    return {
      changed: changed.reduce<number>((sum, value) => sum + value, 0),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
