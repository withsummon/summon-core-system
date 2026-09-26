import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { clientFields } from "./schema";
import { pageBudget, parseClient, requireClient, validateOwner } from "./validation";

export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    return ctx.db
      .query("clients")
      .withIndex("by_workspace_name", (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false))
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const get = query({
  args: { workspaceId: v.id("workspaces"), clientId: v.id("clients") },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    return requireClient(ctx, args.workspaceId, args.clientId);
  },
});
export const save = mutation({
  args: { workspaceId: v.id("workspaces"), clientId: v.optional(v.id("clients")), data: v.object(clientFields) },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    if (args.clientId) await requireClient(ctx, args.workspaceId, args.clientId);
    const data = parseClient(args.data);
    await validateOwner(ctx, args.workspaceId, data.ownerId);
    const duplicate = await ctx.db
      .query("clients")
      .withIndex("by_workspace_name", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("deleted", false).eq("name", data.name)
      )
      .unique();
    if (duplicate && duplicate._id !== args.clientId) throw new ConvexError("A client with this name already exists.");
    const updated = { ...data, updatedBy: user._id, updatedAt: Date.now() };
    if (args.clientId) {
      await ctx.db.patch(args.clientId, updated);
      return args.clientId;
    }
    return ctx.db.insert("clients", { ...updated, workspaceId: args.workspaceId, createdBy: user._id, deleted: false });
  },
});
export const remove = mutation({
  args: { workspaceId: v.id("workspaces"), clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    await requireClient(ctx, args.workspaceId, args.clientId);
    await ctx.db.patch(args.clientId, { deleted: true, updatedBy: user._id, updatedAt: Date.now() });
  },
});
