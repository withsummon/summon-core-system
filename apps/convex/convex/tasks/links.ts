import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { linkTitle, linkUrl, linkMetadata } from "../quickLinks/validation";
import { requireTask, taskIsActive } from "./access";
import { taskChanged } from "./revision";
function metadata(value: unknown) {
  const result = linkMetadata(value);
  if (JSON.stringify(result).length > 10000) throw new ConvexError("Link metadata must be at most 10,000 characters.");
  return result;
}
async function requireLink(ctx: QueryCtx, taskId: Id<"tasks">, linkId: Id<"taskLinks">, write = false) {
  const task = await requireTask(ctx, taskId, write ? "active" : "read");
  const permission = await requireProject(ctx, task.projectId, write);
  const link = await ctx.db.get(linkId);
  if (!link || link.taskId !== task._id) throw new ConvexError("Task link not found.");
  if (link.deletedAt !== null && !write) await requireProject(ctx, task.projectId, true);
  return { task, link, ...permission };
}
function revision(link: Doc<"taskLinks">, expected: number) {
  if (!Number.isSafeInteger(expected) || link.updatedAt !== expected)
    throw new ConvexError("This link changed. Reopen it before saving.");
  return Math.max(Date.now(), link.updatedAt + 1);
}
async function uniqueUrl(ctx: QueryCtx, taskId: Id<"tasks">, url: string, except?: Id<"taskLinks">) {
  const row = await ctx.db
    .query("taskLinks")
    .withIndex("by_task_url_deleted", (q) => q.eq("taskId", taskId).eq("url", url).eq("deletedAt", null))
    .unique();
  if (row && row._id !== except) throw new ConvexError("URL already exists for this task.");
}
export const access = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, "read");
    const permission = await requireProject(ctx, task.projectId);
    return {
      canWrite: taskIsActive(task) && permission.member.role !== "guest" && permission.projectMember.role !== "guest",
    };
  },
});
export const list = query({
  args: { taskId: v.id("tasks"), deleted: v.boolean(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, "read");
    if (args.deleted) await requireProject(ctx, task.projectId, true);
    const result = await ctx.db
      .query("taskLinks")
      .withIndex("by_task_deleted", (q) =>
        args.deleted ? q.eq("taskId", task._id).gt("deletedAt", null) : q.eq("taskId", task._id).eq("deletedAt", null)
      )
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    return result;
  },
});
export const get = query({
  args: { taskId: v.id("tasks"), linkId: v.id("taskLinks") },
  handler: async (ctx, args) => (await requireLink(ctx, args.taskId, args.linkId)).link,
});
export const create = mutation({
  args: {
    taskId: v.id("tasks"),
    url: v.string(),
    title: v.optional(v.union(v.string(), v.null())),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    const { user } = await requireProject(ctx, task.projectId, true);
    const url = linkUrl(args.url);
    await uniqueUrl(ctx, task._id, url);
    const id = await ctx.db.insert("taskLinks", {
      taskId: task._id,
      url,
      title: linkTitle(args.title ?? null),
      metadata: metadata(args.metadata ?? {}),
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: Date.now(),
      deletedAt: null,
    });
    await taskChanged(ctx, task, user._id);
    return id;
  },
});
export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    linkId: v.id("taskLinks"),
    expectedUpdatedAt: v.number(),
    url: v.optional(v.string()),
    title: v.optional(v.union(v.string(), v.null())),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { task, link, user } = await requireLink(ctx, args.taskId, args.linkId, true);
    if (link.deletedAt !== null) throw new ConvexError("Restore this link before editing.");
    const updatedAt = revision(link, args.expectedUpdatedAt);
    const url = args.url === undefined ? link.url : linkUrl(args.url);
    await uniqueUrl(ctx, task._id, url, link._id);
    await ctx.db.patch(link._id, {
      url,
      title: args.title === undefined ? link.title : linkTitle(args.title),
      metadata: args.metadata === undefined ? link.metadata : metadata(args.metadata),
      updatedBy: user._id,
      updatedAt,
    });
    await taskChanged(ctx, task, user._id);
  },
});
export const lifecycle = mutation({
  args: { taskId: v.id("tasks"), linkId: v.id("taskLinks"), expectedUpdatedAt: v.number(), deleted: v.boolean() },
  handler: async (ctx, args) => {
    const { task, link, user } = await requireLink(ctx, args.taskId, args.linkId, true);
    const updatedAt = revision(link, args.expectedUpdatedAt);
    if (args.deleted === (link.deletedAt !== null)) throw new ConvexError("Link lifecycle already changed.");
    if (!args.deleted) await uniqueUrl(ctx, task._id, link.url, link._id);
    await ctx.db.patch(link._id, { deletedAt: args.deleted ? Date.now() : null, updatedAt, updatedBy: user._id });
    await taskChanged(ctx, task, user._id);
  },
});
