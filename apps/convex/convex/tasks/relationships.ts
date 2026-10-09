import { ConvexError, v } from "convex/values";
import { query, mutation, type MutationCtx } from "../_generated/server";
import { requireProject } from "../identity/access";
import { requireTask, taskIsReadable, taskCanRead } from "./access";
import { projectReader, projectSummary } from "../savedViews/scope";
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
const MAX_GRAPH_EDGES = 1000;
export const list = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await requireTask(ctx, taskId, "read");
    const { user, member, projectMember } = await requireProject(ctx, task.projectId);
    const readProject = projectReader(ctx, task.workspaceId, user._id);
    const canCleanUnavailable = member.role !== "guest" && projectMember.role !== "guest";
    const [outgoing, incoming] = await Promise.all([
      ctx.db
        .query("taskRelations")
        .withIndex("by_from", (q) => q.eq("fromId", taskId))
        .take(MAX_GRAPH_EDGES + 1),
      ctx.db
        .query("taskRelations")
        .withIndex("by_to", (q) => q.eq("toId", taskId))
        .take(MAX_GRAPH_EDGES + 1),
    ]);
    if (outgoing.length > MAX_GRAPH_EDGES || incoming.length > MAX_GRAPH_EDGES)
      throw new ConvexError("This task exceeds the 1000 relationships per direction read limit.");
    const rows = await Promise.all(
      [...outgoing, ...incoming].map(async (relation) => {
        const related = await ctx.db.get(relation.fromId === taskId ? relation.toId : relation.fromId);
        if (!related || relation.workspaceId !== task.workspaceId) return null;
        const access = await readProject(related.projectId);
        if (!access) return null;
        const readable = taskIsReadable(related);
        if (readable && !(await taskCanRead(ctx, related, user._id))) return null;
        const canRemove = canCleanUnavailable && access.member.role !== "guest";
        if (!readable && !canRemove) return null;
        return relationResult(relation, taskId, related, access.project, canRemove);
      })
    );
    return rows.filter((row) => row !== null);
  },
});
function relationResult(
  relation: Doc<"taskRelations">,
  taskId: Id<"tasks">,
  related: Doc<"tasks">,
  project: Doc<"projects">,
  canRemove: boolean
) {
  const task = taskIsReadable(related) ? related : null;
  return {
    relation,
    task,
    project: projectSummary(project),
    canRemove,
    unavailable: task === null,
    direction: relation.toId === taskId ? inverse[relation.kind] : relation.kind,
  };
}
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
    if (task.workspaceId !== related.workspaceId)
      throw new ConvexError("Related tasks must belong to the same workspace.");
    requireTaskRevision(task, args.expectedUpdatedAt);
    requireTaskRevision(related, args.expectedRelatedUpdatedAt);
    const { fromId, toId, kind } = canonicalRelation(args.kind, task._id, related._id);
    const pair = await ctx.db
      .query("taskRelations")
      .withIndex("by_pair", (q) => q.eq("fromId", fromId).eq("toId", toId))
      .first();
    const reversePair = await ctx.db
      .query("taskRelations")
      .withIndex("by_pair", (q) => q.eq("fromId", toId).eq("toId", fromId))
      .first();
    if (pair || reversePair) throw new ConvexError("These tasks already have a relationship.");
    if (kind === "blocks") {
      const edges = await ctx.db
        .query("taskRelations")
        .withIndex("by_workspace_kind", (q) => q.eq("workspaceId", task.workspaceId).eq("kind", "blocks"))
        .take(MAX_GRAPH_EDGES + 1);
      if (edges.length >= MAX_GRAPH_EDGES)
        throw new ConvexError("A workspace supports up to 1000 blocking relationships.");
      assertAcyclic(edges, fromId, toId);
    }
    const id = await ctx.db.insert("taskRelations", {
      workspaceId: task.workspaceId,
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
export async function removeRelationship(
  ctx: MutationCtx,
  relation: Doc<"taskRelations">,
  task: Doc<"tasks">,
  related: Doc<"tasks">,
  actorId: Id<"users">,
  delivery: NonNullable<Parameters<typeof taskChanged>[4]> = "subscribers"
) {
  await ctx.db.delete(relation._id);
  await taskChanged(ctx, task, actorId, undefined, delivery);
  await taskChanged(ctx, related, actorId, undefined, delivery);
}
export const remove = mutation({
  args: { relationId: v.id("taskRelations"), taskId: v.id("tasks"), expectedUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const relation = await ctx.db.get(args.relationId);
    if (!relation) throw new ConvexError("Relationship not found.");
    if (relation.fromId !== args.taskId && relation.toId !== args.taskId)
      throw new ConvexError("Relationship does not belong to this task.");
    const task = await requireTask(ctx, args.taskId);
    const related = await ctx.db.get(relation.fromId === task._id ? relation.toId : relation.fromId);
    if (!related || related.workspaceId !== task.workspaceId || relation.workspaceId !== task.workspaceId)
      throw new ConvexError("Related task not found in this workspace.");
    const { user } = await requireProject(ctx, task.projectId, true);
    await requireProject(ctx, related.projectId, true);
    requireTaskRevision(task, args.expectedUpdatedAt);
    await removeRelationship(ctx, relation, task, related, user._id);
  },
});
