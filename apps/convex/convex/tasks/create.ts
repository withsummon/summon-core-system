import { requireUsableLabel } from "./label_access";
import { ConvexError } from "convex/values";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { priority, status, taskProperties } from "./schema";
import { requireProject } from "../identity/access";
import { requireParent } from "./hierarchy";
import { initialProperties, validateProperties, parseTaskText } from "./properties";
import { writeDescription } from "./description_content";
import { plainDescriptionHtml } from "./rich_content";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { recordTaskEvent } from "../notifications/delivery";
import { checkAncestors } from "./hierarchy";
import { taskChanged } from "./revision";
import { addSubscribers } from "../notifications/subscriptions";
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
  >,
  parent: Doc<"tasks"> | null = null,
  html?: string
) {
  const { title, description, status: nextStatus, ...data } = fields;
  await Promise.all(fields.labelIds.map((id) => requireUsableLabel(ctx, id)));
  const last = await ctx.db
    .query("tasks")
    .withIndex("by_project_state_order", (q) =>
      q.eq("projectId", project._id).eq("stateId", data.stateId).eq("status", nextStatus).eq("deletedAt", null)
    )
    .order("desc")
    .first();
  const sortOrder = last ? last.sortOrder + 10000 : 65535;
  if (!Number.isFinite(sortOrder) || (last && sortOrder <= last.sortOrder))
    throw new ConvexError("Task ordering has reached its numeric limit.");
  const taskId = await ctx.db.insert("tasks", {
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
    priorityOrder: priority.members.findIndex(({ value }) => value === data.priority),
    createdBy: userId,
    updatedAt: Date.now(),
  });
  const created = await ctx.db.get(taskId);
  if (!created) throw new Error("Created task missing from transaction.");
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

const propertiesValidator = v.object(taskProperties);
export async function createPreparedTask(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    title: string;
    description?: string;
    useDefaultState?: boolean;
    status?: Infer<typeof status>;
    properties?: Infer<typeof propertiesValidator>;
    parent?: { taskId: Id<"tasks">; expectedUpdatedAt: number };
  },
  html?: string
) {
  const { user, project } = await requireProject(ctx, args.projectId, true);
  const { title, description } = parseTaskText(args.title, args.description ?? "");
  const parent = args.parent
    ? await requireParent(ctx, project._id, args.parent.taskId, args.parent.expectedUpdatedAt)
    : null;
  const defaultState = await ctx.db
    .query("taskStates")
    .withIndex("by_project_default", (q) => q.eq("projectId", project._id).eq("isDefault", true))
    .unique();
  const { data, state } = await validateProperties(
    ctx,
    project,
    args.properties
      ? { ...args.properties, stateId: args.useDefaultState ? (defaultState?._id ?? null) : args.properties.stateId }
      : { ...initialProperties, stateId: defaultState?._id ?? null }
  );
  if (state && args.status && state.status !== args.status)
    throw new ConvexError("Task status must match its custom state.");
  const nextStatus = state?.status ?? args.status ?? "todo";
  return createTask(ctx, project, user._id, { title, description, ...data, status: nextStatus }, parent, html);
}
