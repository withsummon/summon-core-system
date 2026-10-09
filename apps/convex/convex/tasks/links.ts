import { compareValues, ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { linkTitle, linkUrl, linkMetadata } from "../quickLinks/validation";
import { requireTask, taskIsActive } from "./access";
import { taskChanged } from "./revision";
import { allocateTaskCompanionApiId, taskTables } from "./schema";
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
}
async function uniqueUrl(ctx: QueryCtx, taskId: Id<"tasks">, url: string, except?: Id<"taskLinks">) {
  const rows = ctx.db
    .query("taskLinks")
    .withIndex("by_task_url_deleted", (q) => q.eq("taskId", taskId).eq("url", url).eq("deletedAt", null));
  if (await (except ? rows.filter((q) => q.neq(q.field("_id"), except)) : rows).first())
    throw new ConvexError("URL already exists for this task.");
}
export async function writeTaskLink(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  actorId: Id<"users">,
  link: Doc<"taskLinks"> | null,
  fields: Pick<Doc<"taskLinks">, "url" | "title" | "metadata" | "deletedAt" | "createdBy">,
  delivery: NonNullable<Parameters<typeof taskChanged>[4]> = "subscribers"
) {
  const updatedAt = link ? Math.max(Date.now(), link.updatedAt + 1) : Date.now();
  const id = link
    ? link._id
    : await ctx.db.insert("taskLinks", {
        ...fields,
        apiId: await allocateTaskCompanionApiId(ctx, "taskLinks"),
        taskId: task._id,
        updatedBy: actorId,
        updatedAt,
      });
  if (link) await ctx.db.patch(id, { ...fields, updatedAt, updatedBy: actorId });
  await taskChanged(
    ctx,
    task,
    actorId,
    {
      kind: "updated",
      changes: [
        {
          field: "link",
          linkId: id,
          before: link && link.deletedAt === null ? link.url : null,
          after: fields.deletedAt === null ? fields.url : null,
        },
      ],
    },
    delivery
  );
  return id;
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
    return writeTaskLink(ctx, task, user._id, null, {
      url,
      title: linkTitle(args.title ?? null),
      metadata: metadata(args.metadata ?? {}),
      createdBy: user._id,
      deletedAt: null,
    });
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
    revision(link, args.expectedUpdatedAt);
    const url = args.url === undefined ? link.url : linkUrl(args.url);
    await uniqueUrl(ctx, task._id, url, link._id);
    await writeTaskLink(ctx, task, user._id, link, {
      url,
      title: args.title === undefined ? link.title : linkTitle(args.title),
      metadata: args.metadata === undefined ? link.metadata : metadata(args.metadata),
      createdBy: link.createdBy,
      deletedAt: link.deletedAt,
    });
  },
});
export const lifecycle = mutation({
  args: { taskId: v.id("tasks"), linkId: v.id("taskLinks"), expectedUpdatedAt: v.number(), deleted: v.boolean() },
  handler: async (ctx, args) => {
    const { task, link, user } = await requireLink(ctx, args.taskId, args.linkId, true);
    revision(link, args.expectedUpdatedAt);
    if (args.deleted === (link.deletedAt !== null)) throw new ConvexError("Link lifecycle already changed.");
    if (!args.deleted) await uniqueUrl(ctx, task._id, link.url, link._id);
    await writeTaskLink(ctx, task, user._id, link, {
      url: link.url,
      title: link.title,
      metadata: link.metadata,
      createdBy: link.createdBy,
      deletedAt: args.deleted ? Date.now() : null,
    });
  },
});

// Remove after both hosts prove complete UUID coverage and a zero-change second pass.
export const adoptApiIdentity = internalMutation({
  args: {
    expected: v.array(
      v.object({ ...taskTables.taskLinks.validator.fields, _id: v.id("taskLinks"), _creationTime: v.number() })
    ),
  },
  handler: async (ctx, args) => {
    if (args.expected.length < 1 || args.expected.length > 20)
      throw new ConvexError("Adopt between 1 and 20 exact Link preimages.");
    const changes = [];
    /* oxlint-disable no-await-in-loop */
    for (const expected of args.expected) {
      const current = await ctx.db.get(expected._id);
      if (!current || compareValues(current, expected) !== 0)
        throw new ConvexError("Link changed. Capture its current preimage before adoption.");
      if (current.apiId !== undefined) continue;
      if (!(await ctx.db.get(current.taskId))) throw new ConvexError("Link task is missing.");
      await ctx.db.patch(current._id, { apiId: await allocateTaskCompanionApiId(ctx, "taskLinks") });
      changes.push({ before: current, after: await ctx.db.get(current._id) });
    }
    /* oxlint-enable no-await-in-loop */
    return changes;
  },
});
