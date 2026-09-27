import { ConvexError, v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireProject } from "../identity/access";
import { requireTask, taskIsReadable, taskCanRead } from "./access";
import { relationKind } from "./schema";
import { requireTaskRevision, taskChanged } from "./revision";
import type { Doc, Id } from "../_generated/dataModel";

const relationDirection = v.union(
  relationKind,
  v.literal("blocked_by"),
  v.literal("start_after"),
  v.literal("finish_after"),
  v.literal("implements")
);
const inverse = {
  blocks: "blocked_by",
  start_before: "start_after",
  finish_before: "finish_after",
  implemented_by: "implements",
  relates_to: "relates_to",
  duplicate: "duplicate",
} as const;
function canonicalRelation(kind: typeof relationDirection.type, taskId: Id<"tasks">, relatedId: Id<"tasks">) {
  const reversed = {
    blocked_by: "blocks",
    start_after: "start_before",
    finish_after: "finish_before",
    implements: "implemented_by",
  } as const;
  if (kind === "blocked_by" || kind === "start_after" || kind === "finish_after" || kind === "implements")
    return { kind: reversed[kind], fromId: relatedId, toId: taskId };
  const symmetric = kind === "relates_to" || kind === "duplicate";
  return {
    kind,
    fromId: symmetric && taskId > relatedId ? relatedId : taskId,
    toId: symmetric && taskId > relatedId ? taskId : relatedId,
  };
}
const MAX_PROJECT_RELATIONS = 1000;
export const list = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await requireTask(ctx, taskId, "read");
    const { user, member, projectMember } = await requireProject(ctx, task.projectId);
    const canCleanUnavailable = member.role !== "guest" && projectMember.role !== "guest";
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
    const rows = await Promise.all(
      [...outgoing, ...incoming].map(async (relation) => {
        const related = await ctx.db.get(relation.fromId === taskId ? relation.toId : relation.fromId);
        const readable = related !== null && taskIsReadable(related);
        if (readable && !(await taskCanRead(ctx, related, user._id))) return null;
        if (!readable && !canCleanUnavailable) return null;
        return {
          relation,
          task: readable ? related : null,
          unavailable: !readable,
          direction: relation.toId === taskId ? inverse[relation.kind] : relation.kind,
        };
      })
    );
    return rows.filter((row) => row !== null);
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
    kind: relationDirection,
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
    const { fromId, toId, kind } = canonicalRelation(args.kind, task._id, related._id);
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
    if (kind === "blocks") assertAcyclic(edges, fromId, toId);
    const id = await ctx.db.insert("taskRelations", {
      projectId: task.projectId,
      fromId,
      toId,
      kind,
    });
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
    const related = await ctx.db.get(relation.fromId === task._id ? relation.toId : relation.fromId);
    if (!related || related.projectId !== task.projectId)
      throw new ConvexError("Related task not found in this project.");
    const { user } = await requireProject(ctx, task.projectId, true);
    await requireProject(ctx, related.projectId, true);
    requireTaskRevision(task, args.expectedUpdatedAt);
    await ctx.db.delete(relation._id);
    await taskChanged(ctx, task, user._id);
    await taskChanged(ctx, related, user._id);
  },
});
