import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { pageBudget } from "../commercial/validation";
import { taskChanged } from "../tasks/revision";
import { prepareAsset } from "./index";
import { descriptor } from "./access";
import { requireTaskAttachmentAccess, canManageAttachment, attachmentRevision } from "./task_access";

export const access = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const permission = await requireTaskAttachmentAccess(ctx, args.taskId);
    return {
      taskId: permission.task._id,
      workspaceId: permission.task.workspaceId,
      projectId: permission.task.projectId,
      canUpload: permission.task.archivedAt == null,
    };
  },
});
export const prepare = mutation({
  args: { taskId: v.id("tasks"), name: v.string(), contentType: v.string(), size: v.number(), sha256: v.string() },
  handler: async (ctx, { taskId, ...file }) => {
    const { task } = await requireTaskAttachmentAccess(ctx, taskId, true);
    return prepareAsset(ctx, {
      ...file,
      taskId,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      documentId: null,
    });
  },
});
async function projection(
  ctx: QueryCtx,
  asset: Doc<"assets">,
  permission: Awaited<ReturnType<typeof requireTaskAttachmentAccess>>
) {
  const manages = canManageAttachment(asset, permission) && permission.task.archivedAt == null;
  const bytesExist = asset.storageId !== null && (await ctx.db.system.get(asset.storageId)) !== null;
  return {
    ...descriptor(asset),
    revision: attachmentRevision(asset),
    status: asset.status,
    canRemove: manages && asset.status === "ready",
    canRestore: manages && asset.status === "deleted" && asset.expiresAt > Date.now() && bytesExist,
    restoreUntil: asset.status === "deleted" ? asset.expiresAt : null,
  };
}
export const list = query({
  args: { taskId: v.id("tasks"), deleted: v.boolean(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const permission = await requireTaskAttachmentAccess(ctx, args.taskId);
    const result = await ctx.db
      .query("assets")
      .withIndex("by_task_status", (q) => q.eq("taskId", args.taskId).eq("status", args.deleted ? "deleted" : "ready"))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const visible = result.page.filter((asset) => !args.deleted || canManageAttachment(asset, permission));
    return { ...result, page: await Promise.all(visible.map((asset) => projection(ctx, asset, permission))) };
  },
});
export const get = query({
  args: { taskId: v.id("tasks"), assetId: v.string() },
  handler: async (ctx, args) => {
    const permission = await requireTaskAttachmentAccess(ctx, args.taskId);
    const id = ctx.db.normalizeId("assets", args.assetId);
    const asset = id ? await ctx.db.get(id) : null;
    if (!asset || asset.taskId !== args.taskId || !["ready", "deleted"].includes(asset.status))
      throw new ConvexError("Task attachment not found.");
    if (asset.status === "deleted" && !canManageAttachment(asset, permission))
      throw new ConvexError("Task attachment not found.");
    return projection(ctx, asset, permission);
  },
});
export const change = mutation({
  args: { taskId: v.id("tasks"), assetId: v.id("assets"), expectedRevision: v.number(), deleted: v.boolean() },
  handler: async (ctx, args) => {
    const permission = await requireTaskAttachmentAccess(ctx, args.taskId, true);
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.taskId !== args.taskId) throw new ConvexError("Task attachment not found.");
    if (!canManageAttachment(asset, permission))
      throw new ConvexError("Only the uploader or an administrator can change this attachment.");
    const revision = attachmentRevision(asset);
    if (args.expectedRevision !== revision) throw new ConvexError("Attachment changed. Refresh before trying again.");
    const expectedStatus = args.deleted ? "ready" : "deleted";
    if (asset.status !== expectedStatus) throw new ConvexError("Attachment is not in the expected state.");
    if (!args.deleted) await requireRestorable(ctx, asset);
    await ctx.db.patch(asset._id, {
      status: args.deleted ? "deleted" : "ready",
      expiresAt: args.deleted ? Date.now() + 7 * 24 * 60 * 60 * 1000 : asset.expiresAt,
      attachmentRevision: revision + 1,
    });
    await taskChanged(ctx, permission.task, permission.user._id);
    return asset._id;
  },
});
async function requireRestorable(ctx: QueryCtx, asset: Doc<"assets">) {
  if (asset.expiresAt <= Date.now()) throw new ConvexError("The attachment restore period has expired.");
  if (!asset.storageId || !(await ctx.db.system.get(asset.storageId)))
    throw new ConvexError("Attachment bytes are missing.");
}
