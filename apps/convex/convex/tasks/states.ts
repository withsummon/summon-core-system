import { compareValues, ConvexError, v, type Infer } from "convex/values";
import { mutation, query, type MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { canAdministerProject } from "../projects/administration";
import { checkRevision } from "../projects/settings";
import { stateContentFields, status, allocateTaskStateApiId } from "./schema";
import { text } from "../commercial/validation";
import { applyPropertyUpdate } from "./property_updates";

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    const states = await ctx.db
      .query("taskStates")
      .withIndex("by_project_order", (q) => q.eq("projectId", args.projectId))
      .collect();
    return states.flatMap((state) => (state.status === "triage" ? [] : [{ ...state, status: state.status }]));
  },
});

async function catalogue(ctx: MutationCtx, projectId: Id<"projects">, expectedRevision: number) {
  const access = await requireProject(ctx, projectId);
  if (!(await canAdministerProject(ctx, access.project, access.user._id, access.member.role)))
    throw new ConvexError("Only workspace or project administrators can manage task states.");
  const metadataRevision = checkRevision(access.project, expectedRevision);
  const states = await ctx.db
    .query("taskStates")
    .withIndex("by_project_order", (q) => q.eq("projectId", projectId))
    .take(101);
  if (states.length > 100) throw new ConvexError("A project supports up to 100 task states.");
  const defaults = states.filter((state) => state.isDefault);
  if (defaults.length !== 1 || defaults[0]?.status === "triage")
    throw new ConvexError("The project state catalogue requires one ordinary default state. Repair it before editing.");
  return { ...access, states, metadataRevision };
}

function ordinaryState(states: Doc<"taskStates">[], stateId: Id<"taskStates">) {
  const state = states.find((row) => row._id === stateId);
  if (!state || state.status === "triage") throw new ConvexError("State not found in this project.");
  return { ...state, status: state.status };
}

async function requireUnconfiguredCancellationState(ctx: MutationCtx, state: ReturnType<typeof ordinaryState>) {
  const policy = await ctx.db
    .query("projectInactivityPolicies")
    .withIndex("by_project", (q) => q.eq("projectId", state.projectId))
    .unique();
  if (policy?.close?.stateId === state._id)
    throw new ConvexError("Choose another inactivity automation cancellation state first.");
}

function requireAnotherGroupState(states: Doc<"taskStates">[], state: ReturnType<typeof ordinaryState>) {
  if (!states.some((row) => row._id !== state._id && row.status === state.status))
    throw new ConvexError("Keep at least one state in every group.");
}

function positionOrder(states: Doc<"taskStates">[], beforeStateId: Id<"taskStates"> | null) {
  const index = beforeStateId === null ? states.length : states.findIndex((row) => row._id === beforeStateId);
  if (index < 0) throw new ConvexError("Choose an ordering destination in the target group.");
  const previous = states[index - 1]?.sortOrder;
  const next = states[index]?.sortOrder;
  const sortOrder =
    previous === undefined
      ? next === undefined
        ? 65535
        : next - 15000
      : next === undefined
        ? previous + 15000
        : previous / 2 + next / 2;
  if (
    !Number.isFinite(sortOrder) ||
    (previous !== undefined && sortOrder <= previous) ||
    (next !== undefined && sortOrder >= next)
  )
    throw new ConvexError("These states have no available ordering gap. Choose another position.");
  return sortOrder;
}

async function changeGroup(
  ctx: MutationCtx,
  access: Awaited<ReturnType<typeof catalogue>>,
  state: ReturnType<typeof ordinaryState>,
  nextStatus: Infer<typeof status>
) {
  if (state.status === nextStatus) return;
  requireAnotherGroupState(access.states, state);
  await requireUnconfiguredCancellationState(ctx, state);
  await ctx.db.patch(state._id, { status: nextStatus });
  // State identity stays stable. Both indexed task statuses and private draft references
  // publish in this transaction; a platform limit failure rolls back the entire move.
  for await (const task of ctx.db.query("tasks").withIndex("by_state", (q) => q.eq("stateId", state._id))) {
    if (task.projectId !== state.projectId || task.workspaceId !== state.workspaceId || task.status === "triage")
      throw new ConvexError("The state has an invalid task reference. Repair it before moving groups.");
    // Catalogue changes create task activity without notifying every task subscriber.
    // oxlint-disable-next-line no-await-in-loop
    await applyPropertyUpdate(
      ctx,
      {
        task: { ...task, status: task.status },
        user: access.user,
        data: { stateId: task.stateId },
        status: nextStatus,
      },
      undefined,
      undefined,
      "activity"
    );
  }
  const drafts = ctx.db
    .query("taskDrafts")
    .withIndex("by_project_state_unpublished", (q) =>
      q.eq("projectId", state.projectId).eq("properties.stateId", state._id).eq("publishedTaskId", null)
    );
  for await (const draft of drafts) {
    if (draft.workspaceId !== state.workspaceId)
      throw new ConvexError("The state has an invalid draft reference. Repair it before moving groups.");
    // Deleted unpublished drafts retain a consistent state when their author restores them.
    // oxlint-disable-next-line no-await-in-loop
    await ctx.db.patch(draft._id, {
      status: draft.status === null ? null : nextStatus,
      contentRevision: draft.contentRevision + 1,
      updatedAt: Math.max(Date.now(), draft.updatedAt + 1),
    });
  }
}

export const save = mutation({
  args: {
    projectId: v.id("projects"),
    expectedRevision: v.number(),
    stateId: v.optional(v.id("taskStates")),
    data: v.object(stateContentFields),
  },
  handler: async (ctx, args) => {
    const access = await catalogue(ctx, args.projectId, args.expectedRevision);
    const data = {
      ...args.data,
      name: text(args.data.name, "State name", 255, true),
      description: text(args.data.description, "State description", 10000),
      color: text(args.data.color, "State color", 255),
    };
    const existing = args.stateId ? ordinaryState(access.states, args.stateId) : null;
    if (access.states.some((row) => row._id !== existing?._id && row.name === data.name))
      throw new ConvexError("This state name already exists.");
    if (existing) {
      if (compareValues({ ...existing, ...data }, existing) === 0) return existing._id;
      await changeGroup(ctx, access, existing, data.status);
      await ctx.db.patch(existing._id, data);
    } else {
      if (access.states.length >= 100) throw new ConvexError("A project supports up to 100 task states.");
      const group = access.states.filter((row) => row.status === data.status);
      const sortOrder = positionOrder(group, null);
      const stateId = await ctx.db.insert("taskStates", {
        apiId: await allocateTaskStateApiId(ctx),
        ...data,
        sortOrder,
        isDefault: false,
        workspaceId: access.project.workspaceId,
        projectId: access.project._id,
      });
      await ctx.db.patch(access.project._id, { metadataRevision: access.metadataRevision });
      return stateId;
    }
    await ctx.db.patch(access.project._id, { metadataRevision: access.metadataRevision });
    return existing._id;
  },
});

export const markDefault = mutation({
  args: { projectId: v.id("projects"), stateId: v.id("taskStates"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const access = await catalogue(ctx, args.projectId, args.expectedRevision);
    const state = ordinaryState(access.states, args.stateId);
    if (state.isDefault) return state._id;
    await Promise.all(
      access.states.filter((row) => row.isDefault).map((row) => ctx.db.patch(row._id, { isDefault: false }))
    );
    await ctx.db.patch(state._id, { isDefault: true });
    await ctx.db.patch(access.project._id, { metadataRevision: access.metadataRevision });
    return state._id;
  },
});

export const reorder = mutation({
  args: {
    projectId: v.id("projects"),
    expectedRevision: v.number(),
    stateId: v.id("taskStates"),
    status,
    beforeStateId: v.union(v.id("taskStates"), v.null()),
  },
  handler: async (ctx, args) => {
    const access = await catalogue(ctx, args.projectId, args.expectedRevision);
    const state = ordinaryState(access.states, args.stateId);
    const group = access.states.filter((row) => row._id !== state._id && row.status === args.status);
    const sortOrder = positionOrder(group, args.beforeStateId);
    if (state.status === args.status && state.sortOrder === sortOrder) return state._id;
    await changeGroup(ctx, access, state, args.status);
    await ctx.db.patch(state._id, { sortOrder });
    await ctx.db.patch(access.project._id, { metadataRevision: access.metadataRevision });
    return state._id;
  },
});

export const remove = mutation({
  args: { stateId: v.id("taskStates"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const found = await ctx.db.get(args.stateId);
    if (!found || found.status === "triage") throw new ConvexError("State not found.");
    const access = await catalogue(ctx, found.projectId, args.expectedRevision);
    const state = ordinaryState(access.states, found._id);
    if (state.isDefault) throw new ConvexError("Choose another default state first.");
    requireAnotherGroupState(access.states, state);
    await requireUnconfiguredCancellationState(ctx, state);
    if (
      await ctx.db
        .query("tasks")
        .withIndex("by_state", (q) => q.eq("stateId", state._id))
        .first()
    )
      throw new ConvexError("Move tasks out of this state before deleting it.");
    if (
      await ctx.db
        .query("taskDrafts")
        .withIndex("by_project_state_unpublished", (q) =>
          q.eq("projectId", state.projectId).eq("properties.stateId", state._id).eq("publishedTaskId", null)
        )
        .first()
    )
      throw new ConvexError("This state is referenced by an unpublished draft. Change its state before deleting.");
    await ctx.db.delete(state._id);
    await ctx.db.patch(access.project._id, {
      metadataRevision: access.metadataRevision,
      ...(access.project.defaultStateId === state._id ? { defaultStateId: null } : {}),
    });
  },
});
