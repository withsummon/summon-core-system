import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { requireView } from "./access";
import { resultPage } from "./result_page";
import { projectSummary } from "./scope";
export const list = query({
  args: { viewId: v.id("savedViews"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { view, access } = await requireView(ctx, args.viewId);
    const result = await resultPage(
      ctx,
      view,
      access.project.workspaceId,
      access.user._id,
      access.member.role === "guest",
      args.paginationOpts
    );
    return { ...result, page: result.page.map((row) => row.task), project: projectSummary(access.project) };
  },
});
