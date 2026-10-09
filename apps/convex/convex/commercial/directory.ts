import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { requireWorkspace } from "../identity/access";
import { workspaceMembers } from "./member_directory";

export const members = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    return workspaceMembers(ctx, args.workspaceId, args.paginationOpts);
  },
});
