import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { requireTask, taskCanRead } from "../tasks/access";
import { pageBudget } from "../commercial/validation";
export const MAX_MENTION_RECIPIENTS = 20;
export const policy = query({ args: {}, handler: async () => ({ maxRecipients: MAX_MENTION_RECIPIENTS }) });
export const canMention = taskCanRead;
export async function validateMentions(ctx: QueryCtx, task: Doc<"tasks">, ids: Id<"users">[]) {
  if (ids.length > MAX_MENTION_RECIPIENTS || new Set(ids).size !== ids.length)
    throw new ConvexError("Choose up to 20 distinct mention recipients.");
  await Promise.all(
    ids.map(async (id) => {
      if (!(await canMention(ctx, task, id)))
        throw new ConvexError("A mentioned member no longer has access to this task.");
    })
  );
  return ids;
}
export const choices = query({
  args: { taskId: v.id("tasks"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    await requireProject(ctx, task.projectId);
    const result = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", task.projectId))
      .paginate(pageBudget(args.paginationOpts));
    const rows = await Promise.all(
      result.page.map(async (member) => {
        if (!member.active || !(await canMention(ctx, task, member.userId))) return null;
        const user = await ctx.db.get(member.userId);
        return user ? { id: user._id, name: user.name ?? null, email: user.email ?? null } : null;
      })
    );
    return { ...result, page: rows.filter((row) => row !== null) };
  },
});
