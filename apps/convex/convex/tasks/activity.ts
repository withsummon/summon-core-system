import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { pageBudget } from "../commercial/validation";
import { requireTask } from "./access";

// Existing mutation events are the activity owner; this query never reconstructs history.
export const list = query({
  args: { taskId: v.id("tasks"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, "read");
    const result = await ctx.db
      .query("taskEvents")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (event) => {
        const actor = await ctx.db.get(event.actorId);
        return {
          id: event._id,
          at: event._creationTime,
          kind: event.kind,
          status: event.status,
          actorName: actor?.name ?? null,
        };
      })
    );
    return { ...result, page };
  },
});
