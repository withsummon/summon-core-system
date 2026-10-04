import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { requireView } from "./access";
import { resultPage } from "./result_page";
import { projectSummary } from "./scope";
import { validateFilters } from "./filters";
import { taskDisplayFilters, taskDisplayFiltersSchema, viewFilters } from "../tasks/schema";
export const list = query({
  args: {
    viewId: v.id("savedViews"),
    filters: v.optional(viewFilters),
    displayFilters: v.optional(taskDisplayFilters),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { view, access } = await requireView(ctx, args.viewId);
    const filters =
      args.filters === undefined ? view.filters : await validateFilters(ctx, access.project._id, args.filters);
    const display =
      args.displayFilters === undefined ? undefined : taskDisplayFiltersSchema.safeParse(args.displayFilters);
    if (display && !display.success) throw new ConvexError(display.error.message);
    const result = await resultPage(ctx, view, access, args.paginationOpts, {
      filters,
      displayFilters: display?.data ?? view.displayFilters,
    });
    return { ...result, page: result.page.map((row) => row.task), project: projectSummary(access.project) };
  },
});
