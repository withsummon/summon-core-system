import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { pageBudget } from "../commercial/validation";
import { taskIsActive } from "../tasks/access";
import { requireView } from "./access";
import { matchesFilters } from "./filters";
export const list = query({
  args: { viewId: v.id("savedViews"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { view, access } = await requireView(ctx, args.viewId);
    const result = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", view.projectId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const guest = access.projectMember.role === "guest" || access.member.role === "guest";
    const rows = result.page.filter(
      (task) =>
        taskIsActive(task) &&
        (!guest || !!access.project.guestViewAllFeatures || task.createdBy === access.user._id) &&
        matchesFilters(task, view.filters)
    );
    return {
      ...result,
      page: rows,
      viewUpdatedAt: view.updatedAt,
      project: { id: access.project._id, name: access.project.name, identifier: access.project.identifier },
    };
  },
});
