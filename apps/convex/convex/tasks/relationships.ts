import { ConvexError, v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireProject } from "../identity/access";
import { requireTask } from "./properties";
import { relationKind } from "./schema";
import { requireTaskRevision, taskChanged } from "./revision";
import type { Doc, Id } from "../_generated/dataModel";

const MAX_PROJECT_RELATIONS = 1000;
export const list = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await requireTask(ctx, taskId);
    await requireProject(ctx, task.projectId);
    const [outgoing, incoming] = await Promise.all([
      ctx.db
        .query("taskRelations")
        .withIndex("by_from", (q) => q.eq("fromId", taskId))
        .take(MAX_PROJECT_RELATIONS),
      ctx.db
        .query("taskRelations")
        .withIndex("by_to", (q) => q.eq("toId", taskId))
        .take(MAX_PROJECT_RELATIONS),
    ]);
    return Promise.all(
      [...outgoing, ...incoming].map(async (relation) => ({
        relation,
        task: await requireTask(ctx, relation.fromId === taskId ? relation.toId : relation.fromId),
        direction: relation.kind === "blocks" && relation.toId === taskId ? ("blocked_by" as const) : relation.kind,
      }))
    );
  },
});
function assertAcyclic(edges: Doc<"taskRelations">[], fromId: Id<"tasks">, toId: Id<"tasks">) {
  const pending = [toId];
  const visited = new Set<Id<"tasks">>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === fromId) throw new ConvexError("Blocking relationships cannot form a cycle.");
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of edges) {
      if (edge.kind === "blocks" && edge.fromId === current) pending.push(edge.toId);
    }
  }
}
export const add = mutation({
  args: {
    taskId: v.id("tasks"),
    expectedUpdatedAt: v.number(),
    relatedTaskId: v.id("tasks"),
    expectedRelatedUpdatedAt: v.number(),
    kind: relationKind,
  },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    const related = await requireTask(ctx, args.relatedTaskId);
    const { user } = await requireProject(ctx, task.projectId, true);
    await requireProject(ctx, related.projectId, true);
    if (task._id === related._id) throw new ConvexError("A task cannot relate to itself.");
    if (task.projectId !== related.projectId) throw new ConvexError("Related tasks must belong to the same project.");
    requireTaskRevision(task, args.expectedUpdatedAt);
    requireTaskRevision(related, args.expectedRelatedUpdatedAt);
    const [fromId, toId] =
      args.kind !== "blocks" && task._id > related._id ? [related._id, task._id] : [task._id, related._id];
    const edges = await ctx.db
      .query("taskRelations")
      .withIndex("by_project", (q) => q.eq("projectId", task.projectId))
      .take(MAX_PROJECT_RELATIONS + 1);
    if (
      edges.some(
        (edge) => (edge.fromId === fromId && edge.toId === toId) || (edge.fromId === toId && edge.toId === fromId)
      )
    )
      throw new ConvexError("These tasks already have a relationship.");
    if (edges.length >= MAX_PROJECT_RELATIONS)
      throw new ConvexError("A project supports up to 1000 task relationships.");
    if (args.kind === "blocks") assertAcyclic(edges, fromId, toId);
    const id = await ctx.db.insert("taskRelations", { projectId: task.projectId, fromId, toId, kind: args.kind });
    await taskChanged(ctx, task, user._id);
    await taskChanged(ctx, related, user._id);
    return id;
  },
});
export const remove = mutation({
  args: { relationId: v.id("taskRelations"), taskId: v.id("tasks"), expectedUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const relation = await ctx.db.get(args.relationId);
    if (!relation) throw new ConvexError("Relationship not found.");
    if (relation.fromId !== args.taskId && relation.toId !== args.taskId)
      throw new ConvexError("Relationship does not belong to this task.");
    const task = await requireTask(ctx, args.taskId);
    const related = await requireTask(ctx, relation.fromId === task._id ? relation.toId : relation.fromId);
    const { user } = await requireProject(ctx, task.projectId, true);
    await requireProject(ctx, related.projectId, true);
    requireTaskRevision(task, args.expectedUpdatedAt);
    await ctx.db.delete(relation._id);
    await taskChanged(ctx, task, user._id);
    await taskChanged(ctx, related, user._id);
  },
});
