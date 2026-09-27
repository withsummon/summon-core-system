import { accountSessionCleanup } from "../accounts/sessions";
import { requireNotInstanceAdmin } from "../instance/index";
import { ConvexError, v } from "convex/values";
import { action, internalMutation } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { requireIdentity } from "../session";
import { collectAccountProof, verifyAccountProof } from "../accounts/proof";
import { requireAnotherAdmin } from "../../workspaces/index";
import { requireAnotherProjectAdmin } from "../access";
export const commit = internalMutation({
  args: {
    sessionId: v.id("authSessions"),
    accountId: v.optional(v.id("authAccounts")),
    expectedSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, session } = await requireIdentity(ctx);
    if (session._id !== args.sessionId) throw new ConvexError("Sign-in changed. Try again.");
    await verifyAccountProof(ctx, user._id, session, args);
    await requireNotInstanceAdmin(ctx, user._id);
    const workspaces = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(101);
    const projects = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(101);
    if (workspaces.length > 100 || projects.length > 100)
      throw new ConvexError("Account exceeds the atomic deactivation budget. No changes were made.");
    const cleanup = await accountSessionCleanup(ctx, user._id);
    for (const row of workspaces)
      if (row.active && row.role === "admin") await requireAnotherAdmin(ctx, row.workspaceId);
    for (const row of projects)
      if (row.active && row.role === "admin") await requireAnotherProjectAdmin(ctx, row.projectId);
    await ctx.db.insert("accountRestrictions", { userId: user._id, deactivatedAt: Date.now() });
    for (const row of [...workspaces, ...projects]) if (row.active) await ctx.db.patch(row._id, { active: false });
    await Promise.all(cleanup.map((row) => ctx.db.delete(row._id)));
  },
});
export const deactivate = action({
  args: { password: v.optional(v.string()) },
  handler: async (ctx, args): Promise<void> => {
    const proof = await collectAccountProof(ctx, args.password);
    await ctx.runMutation(internal.identity.deactivation.index.commit, proof);
  },
});
