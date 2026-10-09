import { taskStateIsSelectable } from "./schema";
import { requireUsableLabel } from "./label_access";
import { ConvexError } from "convex/values";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { allocateTaskApiId, priority, status, taskProperties } from "./schema";
import { requireProject } from "../identity/access";
import { requireParent } from "./hierarchy";
import { initialProperties, validateProperties, parseTaskText, creationAssignees } from "./properties";
import { writeDescription } from "./description_content";
import { plainDescriptionHtml } from "./rich_content";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { recordTaskEvent } from "../notifications/delivery";
import { checkAncestors } from "./hierarchy";
import { indexTaskCollection, taskChanged } from "./revision";
import { addSubscribers } from "../notifications/subscriptions";
import { requireTask, taskIsActive } from "./access";
import { assignCycleTask } from "../cycles/tasks";
import { setModuleTask } from "../modules/tasks";
import { draftFields, validateModuleReferences } from "./drafts/fields";
// Both ordinary creation and intake submission allocate identity here, in the caller transaction.
export async function createTask(
  ctx: MutationCtx,
  project: Doc<"projects">,
  userId: Id<"users">,
  fields: Pick<
    Doc<"tasks">,
    | "estimatePointId"
    | "title"
    | "description"
    | "status"
    | "priority"
    | "assigneeIds"
    | "labelIds"
    | "startDate"
    | "targetDate"
    | "stateId"
  > &
    Partial<Pick<Doc<"tasks">, "externalSource" | "externalId" | "point" | "sortOrder">>,
  parent: Doc<"tasks"> | null = null,
  html?: string
) {
  const {
    title,
    description,
    status: nextStatus,
    externalSource = null,
    externalId = null,
    point = null,
    sortOrder: requestedSortOrder = 65535,
    ...data
  } = fields;
  await Promise.all(fields.labelIds.map((id) => requireUsableLabel(ctx, id)));
  const last = await ctx.db
    .query("tasks")
    .withIndex("by_project_state_order", (q) =>
      q.eq("projectId", project._id).eq("stateId", data.stateId).eq("status", nextStatus).eq("deletedAt", null)
    )
    .order("desc")
    .first();
  const sortOrder = last ? last.sortOrder + 10000 : requestedSortOrder;
  if (!Number.isFinite(sortOrder) || (last && sortOrder <= last.sortOrder))
    throw new ConvexError("Task ordering has reached its numeric limit.");
  const updatedAt = Date.now();
  const taskId = await ctx.db.insert("tasks", {
    apiId: await allocateTaskApiId(ctx),
    // The creation actor remains createdBy; no updater exists until a later native revision.
    updatedBy: null,
    // Fresh native Projects have no IssueType/link producer. Imported type
    // catalogues remain a separate migration contract, never inferred here.
    type: null,
    point,
    externalSource,
    externalId,
    archivedAt: null,
    deletedAt: null,
    workspaceId: project.workspaceId,
    projectId: project._id,
    title,
    description,
    ...data,
    completedAt: nextStatus === "done" ? Date.now() : null,
    status: nextStatus,
    sequence: project.nextSequence,
    sortOrder,
    // The actual document timestamp replaces this value before the transaction publishes.
    createdAtDescending: 0,
    startDateMissing: data.startDate === null,
    targetDateMissing: data.targetDate === null,
    priorityOrder: priority.members.findIndex(({ value }) => value === data.priority),
    createdBy: userId,
    updatedAt,
    titleUpdatedAt: updatedAt,
    upVoteCount: 0,
    downVoteCount: 0,
  });
  const created = await ctx.db.get(taskId);
  if (!created) throw new Error("Created task missing from transaction.");
  if (taskIsActive(created)) await indexTaskCollection(ctx, created);
  await ctx.db.patch(taskId, { createdAtDescending: -created._creationTime });
  await writeDescription(ctx, created, userId, { html: html ?? plainDescriptionHtml(description), description }, true);
  await addSubscribers(ctx, taskId, [userId]);
  if (parent) {
    await checkAncestors(ctx, taskId, parent);
    await ctx.db.insert("taskParents", {
      projectId: project._id,
      childId: taskId,
      parentId: parent._id,
    });
    await taskChanged(ctx, parent, userId);
  }
  await ctx.db.patch(project._id, { nextSequence: project.nextSequence + 1 });
  await recordTaskEvent(ctx, {
    workspaceId: project.workspaceId,
    projectId: project._id,
    taskId,
    actorId: userId,
    kind: "created",
    status: nextStatus,
  });
  return taskId;
}

export const taskCreateFields = {
  projectId: v.id("projects"),
  title: v.string(),
  description: v.optional(v.string()),
  status: v.optional(status),
  properties: v.optional(v.object(taskProperties)),
  parent: v.optional(draftFields.parent),
  cycle: v.optional(draftFields.cycle),
  modules: v.optional(draftFields.modules),
};
const preparedFields = v.object({ ...taskCreateFields, useDefaultState: v.optional(v.boolean()) });
export async function createPreparedTask(ctx: MutationCtx, args: Infer<typeof preparedFields>, html?: string) {
  const { user, project } = await requireProject(ctx, args.projectId, true);
  if (args.modules) validateModuleReferences(args.modules);
  const { title, description } = parseTaskText(args.title, args.description ?? "");
  const parent = args.parent
    ? await requireParent(ctx, project._id, args.parent.taskId, args.parent.expectedUpdatedAt)
    : null;
  const configuredDefault = await ctx.db
    .query("taskStates")
    .withIndex("by_project_default", (q) => q.eq("projectId", project._id).eq("isDefault", true))
    .unique();
  const defaultState = configuredDefault && taskStateIsSelectable(configuredDefault) ? configuredDefault : null;
  const properties = args.properties ?? initialProperties;
  const { data, state } = await validateProperties(ctx, project, {
    ...properties,
    stateId: !args.properties || args.useDefaultState ? (defaultState?._id ?? null) : properties.stateId,
    assigneeIds: await creationAssignees(ctx, project, properties.assigneeIds),
  });
  if (state && args.status && state.status !== args.status)
    throw new ConvexError("Task status must match its custom state.");
  const nextStatus = state?.status ?? args.status ?? "todo";
  const taskId = await createTask(
    ctx,
    project,
    user._id,
    { title, description, ...data, status: nextStatus },
    parent,
    html
  );
  if (args.cycle) {
    const task = await requireTask(ctx, taskId);
    await assignCycleTask(ctx, { ...args.cycle, taskId, expectedTaskUpdatedAt: task.updatedAt });
  }
  // Each relationship advances task CAS in this same transaction.
  for (const ref of args.modules ?? []) {
    // oxlint-disable-next-line no-await-in-loop
    const task = await requireTask(ctx, taskId);
    // oxlint-disable-next-line no-await-in-loop
    await setModuleTask(ctx, { ...ref, taskId, assigned: true, expectedTaskUpdatedAt: task.updatedAt });
  }
  return taskId;
}
