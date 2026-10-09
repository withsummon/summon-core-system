import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { requireDocument } from "./access";
import { workspaceMember, workspaceMembers } from "../commercial/member_directory";

export const search = query({
  args: { documentId: v.id("documents"), search: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { document } = await requireDocument(ctx, args.documentId);
    if (args.search.length > 200) throw new ConvexError("Search for a member with up to 200 characters.");
    return workspaceMembers(ctx, document.workspaceId, args.paginationOpts, args.search);
  },
});
export const resolve = query({
  args: { documentId: v.id("documents"), userIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const { document } = await requireDocument(ctx, args.documentId);
    if (args.userIds.length > 100) throw new ConvexError("Resolve up to 100 document mentions at a time.");
    return Promise.all(
      args.userIds.map(async (rawId) => {
        const id = ctx.db.normalizeId("users", rawId);
        return { id: rawId, member: id ? await workspaceMember(ctx, document.workspaceId, id) : null };
      })
    );
  },
});
