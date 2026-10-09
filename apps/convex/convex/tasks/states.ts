import { compareValues, ConvexError, v, type Infer } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { canAdministerProject } from "../projects/administration";
import { checkRevision } from "../projects/settings";
import {
  taskTables,
  taskStateDeletedAt,
  taskStateIsTriage,
  taskStateIsSelectable,
  stateContentFields,
  status,
  allocateTaskStateApiId,
  stateSlug,
  stateWriteFields,
} from "./schema";
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
    return states.flatMap((state) => (!taskStateIsSelectable(state) ? [] : [{ ...state, status: state.status }]));
  },
});

async function catalogue(ctx: MutationCtx, projectId: Id<"projects">, expectedRevision: number) {
  const access = await requireProject(ctx, projectId);
  if (!(await canAdministerProject(ctx, access.project, access.user._id, access.member.role)))
    throw new ConvexError("Only workspace or project administrators can manage task states.");
  const metadataRevision = checkRevision(access.project, expectedRevision);
  const stored = await ctx.db
    .query("taskStates")
    .withIndex("by_project_order", (q) => q.eq("projectId", projectId))
    .collect();
  const states = stored.filter((row) => taskStateDeletedAt(row.deletedAt) === null);
  if (states.length > 100) throw new ConvexError("A project supports up to 100 task states.");
  return { ...access, states, metadataRevision };
}

function ordinaryState(states: Doc<"taskStates">[], stateId: Id<"taskStates">) {
  const state = states.find((row) => row._id === stateId);
  if (!state || !taskStateIsSelectable(state)) throw new ConvexError("State not found in this project.");
  return { ...state, status: state.status };
}

async function requireUnconfiguredCancellationState(ctx: MutationCtx, state: Doc<"taskStates">) {
  const policy = await ctx.db
    .query("projectInactivityPolicies")
    .withIndex("by_project", (q) => q.eq("projectId", state.projectId))
    .unique();
  if (policy?.close?.stateId === state._id)
    throw new ConvexError({ status: 400, detail: "Choose another inactivity automation cancellation state first." });
}

function requireAnotherGroupState(states: Doc<"taskStates">[], state: ReturnType<typeof ordinaryState>) {
  if (!states.some((row) => row._id !== state._id && taskStateIsSelectable(row) && row.status === state.status))
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

export async function writeStateGroup(
  ctx: MutationCtx,
  user: Doc<"users">,
  state: Doc<"taskStates">,
  nextStatus: Infer<typeof status>
) {
  if (state.status === nextStatus) return;
  await requireUnconfiguredCancellationState(ctx, { ...state, status: nextStatus });
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
        user,
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

export async function writeTaskState(
  ctx: MutationCtx,
  project: Doc<"projects">,
  user: Doc<"users">,
  existing: Doc<"taskStates"> | null,
  data: Infer<typeof stateWrite>
) {
  if (existing) {
    if (existing.projectId !== project._id || existing.workspaceId !== project.workspaceId)
      throw new ConvexError("State not found in this project.");
    if (data.isTriage && !taskStateIsTriage(existing.isTriage))
      await requireUnconfiguredCancellationState(ctx, { ...existing, status: data.status });
    await writeStateGroup(ctx, user, existing, data.status);
    await ctx.db.patch(existing._id, {
      ...data,
      slug: stateSlug(data.name),
      updatedBy: user._id,
      updatedAt: Date.now(),
    });
    return existing._id;
  }
  return ctx.db.insert("taskStates", {
    apiId: await allocateTaskStateApiId(ctx),
    ...data,
    workspaceId: project.workspaceId,
    projectId: project._id,
    deletedAt: null,
    createdBy: user._id,
    updatedBy: null,
    updatedAt: Date.now(),
    slug: stateSlug(data.name),
  });
}
const stateWrite = v.object(stateWriteFields);

export async function retireTaskState(ctx: MutationCtx, state: Doc<"taskStates">, user: Doc<"users">) {
  await requireUnconfiguredCancellationState(ctx, state);
  const deletedAt = Date.now();
  await ctx.db.patch(state._id, { deletedAt, updatedAt: deletedAt, updatedBy: user._id });
  const project = await ctx.db.get(state.projectId);
  if (project?.defaultStateId === state._id) await ctx.db.patch(project._id, { defaultStateId: null });
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
    if (existing && compareValues({ ...existing, ...data }, existing) === 0) return existing._id;
    if (!existing && access.states.length >= 100) throw new ConvexError("A project supports up to 100 task states.");
    if (existing && existing.status !== data.status) requireAnotherGroupState(access.states, existing);
    const stateId = await writeTaskState(ctx, access.project, access.user, existing, {
      ...data,
      sortOrder:
        existing?.sortOrder ??
        positionOrder(
          access.states.filter((row) => taskStateIsSelectable(row) && row.status === data.status),
          null
        ),
      isDefault: existing?.isDefault ?? false,
      isTriage: false,
      externalSource: existing ? existing.externalSource : null,
      externalId: existing ? existing.externalId : null,
    });
    await ctx.db.patch(access.project._id, { metadataRevision: access.metadataRevision });
    return stateId;
  },
});

export const markDefault = mutation({
  args: { projectId: v.id("projects"), stateId: v.id("taskStates"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const access = await catalogue(ctx, args.projectId, args.expectedRevision);
    const state = ordinaryState(access.states, args.stateId);
    if (!(await writeDefaultState(ctx, state, access.user))) return state._id;
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
    const group = access.states.filter(
      (row) => row._id !== state._id && taskStateIsSelectable(row) && row.status === args.status
    );
    const sortOrder = positionOrder(group, args.beforeStateId);
    if (state.status === args.status && state.sortOrder === sortOrder) return state._id;
    if (state.status !== args.status) requireAnotherGroupState(access.states, state);
    await writeStateGroup(ctx, access.user, state, args.status);
    await ctx.db.patch(state._id, { sortOrder, updatedBy: access.user._id, updatedAt: Date.now() });
    await ctx.db.patch(access.project._id, { metadataRevision: access.metadataRevision });
    return state._id;
  },
});

export const remove = mutation({
  args: { stateId: v.id("taskStates"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const found = await ctx.db.get(args.stateId);
    if (!found || taskStateIsTriage(found.isTriage) || found.status === "triage")
      throw new ConvexError("State not found.");
    const access = await catalogue(ctx, found.projectId, args.expectedRevision);
    const state = ordinaryState(access.states, found._id);
    if (state.isDefault) throw new ConvexError("Choose another default state first.");
    requireAnotherGroupState(access.states, state);
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
    await retireTaskState(ctx, state, access.user);
    await ctx.db.patch(access.project._id, { metadataRevision: access.metadataRevision });
  },
});

export async function writeDefaultState(ctx: MutationCtx, state: Doc<"taskStates">, user: Doc<"users">) {
  const defaults = await ctx.db
    .query("taskStates")
    .withIndex("by_project_default", (q) => q.eq("projectId", state.projectId).eq("isDefault", true))
    .collect();
  if (state.isDefault && defaults.length === 1 && defaults[0]?._id === state._id) return false;
  await Promise.all(
    defaults
      .filter((row) => row._id !== state._id)
      .map((row) => ctx.db.patch(row._id, { isDefault: false, updatedBy: user._id, updatedAt: Date.now() }))
  );
  await ctx.db.patch(state._id, { isDefault: true, updatedBy: user._id, updatedAt: Date.now() });
  return true;
}

// Temporary missing-only migration. Remove after complete field coverage and a
// second zero-write pass on every deployment, then require the stored fields.
export const adoptCatalogue = internalMutation({
  args: {
    expected: v.array(
      v.object({
        ...taskTables.taskStates.validator.fields,
        _id: v.id("taskStates"),
        _creationTime: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.expected.length < 1 || args.expected.length > 20)
      throw new ConvexError("Adopt between 1 and 20 exact State preimages.");
    const changes = [];
    const updatedAt = Date.now();
    // Current project revisions must include preceding writes in this batch.
    /* oxlint-disable no-await-in-loop */
    for (const expected of args.expected) {
      const current = await ctx.db.get(expected._id);
      if (!current || compareValues(current, expected) !== 0)
        throw new ConvexError("State changed. Capture its current preimage before adoption.");
      const fields = [
        current.isTriage,
        current.deletedAt,
        current.slug,
        current.createdBy,
        current.updatedBy,
        current.updatedAt,
        current.externalSource,
        current.externalId,
      ];
      if (fields.every((value) => value !== undefined)) continue;
      if (fields.some((value) => value !== undefined))
        throw new ConvexError("Partial State adoption requires explicit review.");
      const project = await ctx.db.get(current.projectId);
      if (!project || project.workspaceId !== current.workspaceId || !(await ctx.db.get(current.workspaceId)))
        throw new ConvexError("State scope is inconsistent.");
      await ctx.db.patch(current._id, {
        isTriage: current.status === "triage",
        deletedAt: null,
        slug: stateSlug(current.name),
        createdBy: null,
        updatedBy: null,
        updatedAt,
        externalSource: null,
        externalId: null,
      });
      await ctx.db.patch(project._id, { metadataRevision: checkRevision(project, project.metadataRevision) });
      changes.push({ before: current, after: await ctx.db.get(current._id) });
    }
    /* oxlint-enable no-await-in-loop */
    return changes;
  },
});
