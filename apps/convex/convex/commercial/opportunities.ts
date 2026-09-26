import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
import { opportunityFields, opportunityStage } from "./schema";
import { pageBudget, parseOpportunity, probability, validateClient, validateOwner } from "./validation";

export async function requireOpportunity(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  opportunityId: Id<"opportunities">
) {
  const opportunity = await ctx.db.get(opportunityId);
  if (!opportunity || opportunity.deleted || opportunity.workspaceId !== workspaceId)
    throw new ConvexError("Opportunity not found in this workspace.");
  return opportunity;
}
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    return ctx.db
      .query("opportunities")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const get = query({
  args: { workspaceId: v.id("workspaces"), opportunityId: v.id("opportunities") },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    return requireOpportunity(ctx, args.workspaceId, args.opportunityId);
  },
});
export const save = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    opportunityId: v.optional(v.id("opportunities")),
    data: v.object(opportunityFields),
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    const existing = args.opportunityId ? await requireOpportunity(ctx, args.workspaceId, args.opportunityId) : null;
    const data = parseOpportunity(args.data);
    await validateOwner(ctx, args.workspaceId, data.ownerId);
    await validateClient(ctx, args.workspaceId, data.clientId);
    if (existing && existing.clientId !== data.clientId) {
      const profile = await ctx.db
        .query("projectProfiles")
        .withIndex("by_opportunity", (q) => q.eq("sourceOpportunityId", existing._id))
        .unique();
      if (profile) throw new ConvexError("Client cannot change after delivery has started.");
    }
    const duplicate = await ctx.db
      .query("opportunities")
      .withIndex("by_workspace_title", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("deleted", false).eq("title", data.title)
      )
      .unique();
    if (duplicate && duplicate._id !== args.opportunityId)
      throw new ConvexError("An opportunity with this title already exists.");
    const updated = { ...data, updatedBy: user._id, updatedAt: Date.now() };
    if (args.opportunityId) {
      await ctx.db.patch(args.opportunityId, updated);
      return args.opportunityId;
    }
    return ctx.db.insert("opportunities", {
      ...updated,
      workspaceId: args.workspaceId,
      createdBy: user._id,
      deleted: false,
    });
  },
});
export const transition = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    opportunityId: v.id("opportunities"),
    stage: opportunityStage,
    probability: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    const opportunity = await requireOpportunity(ctx, args.workspaceId, args.opportunityId);
    await ctx.db.patch(opportunity._id, {
      stage: args.stage,
      probability: args.probability === undefined ? opportunity.probability : probability(args.probability),
      updatedBy: user._id,
      updatedAt: Date.now(),
    });
    return opportunity._id;
  },
});
export const remove = mutation({
  args: { workspaceId: v.id("workspaces"), opportunityId: v.id("opportunities") },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    await requireOpportunity(ctx, args.workspaceId, args.opportunityId);
    await ctx.db.patch(args.opportunityId, { deleted: true, updatedBy: user._id, updatedAt: Date.now() });
  },
});
