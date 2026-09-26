import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireWorkspace } from "../identity/access";
import { contactFields } from "./schema";
import { pageBudget, parseContact, requireClient } from "./validation";
async function requireContact(ctx: QueryCtx, clientId: Id<"clients">, contactId: Id<"clientContacts">) {
  const contact = await ctx.db.get(contactId);
  if (!contact || contact.deleted || contact.clientId !== clientId)
    throw new ConvexError("Contact not found for this client.");
  return contact;
}
export const get = query({
  args: { workspaceId: v.id("workspaces"), clientId: v.id("clients"), contactId: v.id("clientContacts") },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    await requireClient(ctx, args.workspaceId, args.clientId);
    return requireContact(ctx, args.clientId, args.contactId);
  },
});
export const list = query({
  args: { workspaceId: v.id("workspaces"), clientId: v.id("clients"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    await requireClient(ctx, args.workspaceId, args.clientId);
    return ctx.db
      .query("clientContacts")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId).eq("deleted", false))
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const save = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    clientId: v.id("clients"),
    contactId: v.optional(v.id("clientContacts")),
    data: v.object(contactFields),
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    await requireClient(ctx, args.workspaceId, args.clientId);
    if (args.contactId) await requireContact(ctx, args.clientId, args.contactId);
    const data = parseContact(args.data);
    if (data.email) {
      const duplicate = await ctx.db
        .query("clientContacts")
        .withIndex("by_client_email", (q) =>
          q.eq("clientId", args.clientId).eq("deleted", false).eq("email", data.email)
        )
        .unique();
      if (duplicate && duplicate._id !== args.contactId)
        throw new ConvexError("A contact with this email already exists for this client.");
    }
    const updated = { ...data, updatedBy: user._id, updatedAt: Date.now() };
    if (args.contactId) {
      await ctx.db.patch(args.contactId, updated);
      return args.contactId;
    }
    return ctx.db.insert("clientContacts", {
      ...updated,
      workspaceId: args.workspaceId,
      clientId: args.clientId,
      createdBy: user._id,
      deleted: false,
    });
  },
});
export const remove = mutation({
  args: { workspaceId: v.id("workspaces"), clientId: v.id("clients"), contactId: v.id("clientContacts") },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    await requireClient(ctx, args.workspaceId, args.clientId);
    await requireContact(ctx, args.clientId, args.contactId);
    await ctx.db.patch(args.contactId, { deleted: true, updatedBy: user._id, updatedAt: Date.now() });
  },
});
