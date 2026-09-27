import { v, ConvexError } from "convex/values";
import { query, mutation, type QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { projectUserProperty } from "./order_owner";
import { defaultProjectNavigation, projectNavigation } from "../../shared/project-navigation";
async function ownProperties(ctx: QueryCtx, projectId: Id<"projects">) {
  const { project, user } = await requireProject(ctx, projectId);
  const row = await projectUserProperty(ctx, project._id, user._id);
  if (!row || row.workspaceId !== project.workspaceId)
    throw new ConvexError("Project personal properties are not initialized.");
  return row;
}
function checkRevision(current: number, expected: number) {
  if (!Number.isSafeInteger(expected) || current !== expected)
    throw new ConvexError("Your project preferences changed. Reload before saving.");
}
export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const row = await ownProperties(ctx, projectId);
    return {
      navigation: row.navigation ?? defaultProjectNavigation,
      hasOverride: row.navigation !== undefined,
      revision: row.revision,
    };
  },
});
export const save = mutation({
  args: { projectId: v.id("projects"), expectedRevision: v.number(), navigation: projectNavigation },
  handler: async (ctx, args) => {
    const row = await ownProperties(ctx, args.projectId);
    checkRevision(row.revision, args.expectedRevision);
    if (new Set(args.navigation.hiddenTabs).size !== args.navigation.hiddenTabs.length)
      throw new ConvexError("Hidden tabs must be distinct.");
    await ctx.db.patch(row._id, { navigation: args.navigation, revision: row.revision + 1 });
  },
});
export const reset = mutation({
  args: { projectId: v.id("projects"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const row = await ownProperties(ctx, args.projectId);
    checkRevision(row.revision, args.expectedRevision);
    if (row.navigation === undefined) return;
    await ctx.db.patch(row._id, { navigation: undefined, revision: row.revision + 1 });
  },
});
