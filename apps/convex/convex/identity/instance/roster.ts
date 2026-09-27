import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation } from "../../_generated/server";
import { requireInstanceAdmin } from "./access";
import { requireUnrestrictedAccount } from "../deactivation/access";
import { pageBudget } from "../../commercial/validation";
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    const page = await ctx.db
      .query("instanceAdmins")
      .withIndex("by_instance", (q) => q.eq("instanceId", instance._id))
      .paginate(pageBudget(args.paginationOpts));
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (row) => {
          const user = await ctx.db.get(row.userId);
          return {
            id: row._id,
            userId: row.userId,
            name: user?.name ?? null,
            email: user?.email ?? null,
            role: row.role,
            revision: row.revision,
            createdAt: row._creationTime,
          };
        })
      ),
    };
  },
});
export const grant = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    const email = args.email.trim().toLowerCase();
    if (!email || email.length > 254) throw new ConvexError("Enter an existing verified account email.");
    const users = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .take(2);
    if (users.length !== 1 || users[0].emailVerificationTime === undefined)
      throw new ConvexError("One existing verified account is required.");
    const user = users[0];
    await requireUnrestrictedAccount(ctx, user._id);
    const existing = await ctx.db
      .query("instanceAdmins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (existing) {
      if (existing.instanceId !== instance._id) throw new ConvexError("Account belongs to another instance authority.");
      return existing._id;
    }
    return ctx.db.insert("instanceAdmins", { instanceId: instance._id, userId: user._id, role: "admin", revision: 1 });
  },
});
export const revoke = mutation({
  args: { membershipId: v.id("instanceAdmins"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { instance } = await requireInstanceAdmin(ctx);
    const member = await ctx.db.get(args.membershipId);
    if (!member || member.instanceId !== instance._id) throw new ConvexError("Instance administrator not found.");
    if (member.revision !== args.expectedRevision)
      throw new ConvexError("Administrator membership changed. Reload before removing.");
    const admins = await ctx.db
      .query("instanceAdmins")
      .withIndex("by_instance", (q) => q.eq("instanceId", instance._id))
      .take(2);
    if (admins.length < 2) throw new ConvexError("Assign another instance administrator first.");
    await ctx.db.delete(member._id);
  },
});
