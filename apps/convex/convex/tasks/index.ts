import { taskIsActive, taskDetail, taskCanRead, taskRoleCanRead, requireTask, taskOrdering } from "./access";
import {
  preparePropertyUpdate,
  applyPropertyUpdate,
  taskPositionOrder,
  editableFields,
  relationshipEdits,
  prepareRelationshipUpdate,
  applyRelationshipUpdate,
} from "./property_updates";
import { syncPlainDescription } from "./description";
import { contentVersion, requireDescriptionVersion, writeDescription, descriptionVersion } from "./description_content";
import { boundDescriptionContent } from "./description_images";
import { createPreparedTask, taskCreateFields } from "./create";
import { changeTaskStatus } from "./status";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { v, ConvexError } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireProject, requireProjectForUser, requireUser } from "../identity/access";
import { status, taskPosition, taskProperties, profileOrder, viewFilters } from "./schema";
import { parseTaskText } from "./properties";
import { taskChanged } from "./revision";
import { plainDescriptionHtml, taskRichContent } from "./rich_content";
import schema from "../schema";
import type { QueryCtx } from "../_generated/server";
import { readTaskParent } from "./hierarchy";
import { readTaskCycle } from "../cycles/tasks";
import { readTaskModules } from "../modules/tasks";
import { validateProperties } from "./properties";
import { matchesFilters, validateShape } from "../savedViews/filters";
import { text as validateText } from "../commercial/validation";
// Application-owned page budgets; callers cannot expand them with pagination hints.
const MAX_PAGE_TASKS = 100;
const MAX_PAGE_BYTES = 1_048_576;

export const list = query({
  args: {
    projectId: v.id("projects"),
    openOnly: v.optional(v.boolean()),
    filters: v.optional(viewFilters),
    search: v.optional(v.string()),
    order: v.optional(profileOrder),
    stateId: v.optional(v.union(v.id("taskStates"), v.null())),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    const { user, member, projectMember, project } = access;
    if (args.filters) validateShape(args.filters);
    const search = validateText(args.search ?? "", "Search", 255).toLowerCase();
    const ordering = taskOrdering[args.order ?? "createdAt"];
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > MAX_PAGE_TASKS
    )
      throw new ConvexError("Request an integer between 1 and 100 tasks per page.");
    const tasks = stream(ctx.db, schema).query("tasks");
    const orderedTasks =
      args.order === "updatedAt"
        ? tasks.withIndex("by_project_updated", (q) => q.eq("projectId", project._id)).order("desc")
        : args.order === undefined || args.order === "createdAt"
          ? tasks.withIndex("by_project", (q) => q.eq("projectId", project._id)).order("desc")
          : tasks.withIndex(ordering.index, (q) => q.eq("workspaceId", project.workspaceId)).order(ordering.direction);
    return orderedTasks
      .map(async (task) => {
        if (
          task.projectId !== project._id ||
          !taskIsActive(task) ||
          (args.openOnly && (task.status === "done" || task.status === "cancelled")) ||
          task.workspaceId !== project.workspaceId ||
          !taskRoleCanRead(task, user._id, member.role, projectMember.role, !!project.guestViewAllFeatures)
        )
          return null;
        if (
          (args.filters && !matchesFilters(task, args.filters)) ||
          (args.stateId !== undefined && task.stateId !== args.stateId) ||
          !`${task.title} ${project.identifier}-${task.sequence}`.toLowerCase().includes(search)
        )
          return null;
        return taskDetail(ctx, task, access);
      })
      .paginate({
        ...args.paginationOpts,
        maximumRowsRead: MAX_PAGE_TASKS,
        maximumBytesRead: MAX_PAGE_BYTES,
      });
  },
});
export const create = mutation({
  args: {
    ...taskCreateFields,
    html: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const content = taskRichContent(args.html ?? plainDescriptionHtml(args.description ?? ""));
    return createPreparedTask(ctx, { ...args, description: content.description }, content.html);
  },
});
export const setStatus = mutation({
  args: { taskId: v.id("tasks"), status },
  handler: async (ctx, args) => {
    await changeTaskStatus(ctx, args);
  },
});

export const get = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const id = ctx.db.normalizeId("tasks", args.taskId);
    const task = id ? await ctx.db.get(id) : null;
    if (!task || task.status === "triage" || !(await taskCanRead(ctx, task, user._id))) return null;
    return taskDetail(ctx, { ...task, status: task.status }, await requireProjectForUser(ctx, task.projectId, user));
  },
});
export async function taskEditSource(ctx: QueryCtx, task: Awaited<ReturnType<typeof requireTask>>) {
  const { project } = await requireProject(ctx, task.projectId);
  const [rich, version, parent, cycle, modules, properties] = await Promise.all([
    ctx.db
      .query("taskDescriptions")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .unique(),
    descriptionVersion(ctx, task._id),
    readTaskParent(ctx, task),
    readTaskCycle(ctx, task),
    readTaskModules(ctx, task),
    validateProperties(ctx, project, task, task),
  ]);
  const expectedEdit = { title: task.title, status: task.status, properties: properties.data };
  return {
    ...expectedEdit,
    expectedEdit,
    html: rich?.html ?? plainDescriptionHtml(task.description),
    descriptionJson: rich?.descriptionJson ?? null,
    descriptionBinary: rich?.descriptionBinary ?? null,
    contentVersion: version,
    parent: parent.task ? { taskId: parent.task._id, expectedUpdatedAt: parent.task.updatedAt } : null,
    hasParent: parent.hasParent,
    canUnlinkParent: parent.canUnlink,
    cycle: cycle.cycle ? { cycleId: cycle.cycle._id, expectedCycleUpdatedAt: cycle.cycle.updatedAt } : null,
    modules: modules.map(({ module }) => ({ moduleId: module._id, expectedModuleUpdatedAt: module.updatedAt })),
  };
}
export const editSnapshot = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await requireTask(ctx, taskId, "read");
    return {
      task: await taskDetail(ctx, task, await requireProject(ctx, task.projectId)),
      ...(await taskEditSource(ctx, task)),
    };
  },
});
export const update = mutation({
  args: {
    taskId: v.id("tasks"),
    expectedUpdatedAt: v.number(),
    position: v.optional(taskPosition),
    content: v.optional(v.object({ html: v.string(), expectedVersion: contentVersion })),
    expectedEdit: v.optional(editableFields),
    ...relationshipEdits,
    ...v.object({ title: v.string(), description: v.string(), status, ...taskProperties }).partial().fields,
  },
  handler: async (
    ctx,
    {
      taskId,
      expectedUpdatedAt,
      position,
      content,
      expectedEdit,
      parent,
      cycle,
      modules,
      title: rawTitle,
      description,
      status: requestedStatus,
      ...properties
    }
  ) => {
    if (content && description !== undefined)
      throw new ConvexError("Choose either rich content or a plain description for this update.");
    if (expectedEdit && !content)
      throw new ConvexError("Edit field receipts require the captured description version.");
    if (expectedEdit && position)
      throw new ConvexError("Edit field receipts cannot authorize a manual ordering change.");
    const prepared = await preparePropertyUpdate(
      ctx,
      taskId,
      expectedUpdatedAt,
      properties,
      requestedStatus,
      expectedEdit
    );
    const preparedRelationships = await prepareRelationshipUpdate(ctx, prepared.task, { parent, cycle, modules });
    if (content) await requireDescriptionVersion(ctx, taskId, content.expectedVersion);
    const rich = content ? await boundDescriptionContent(ctx, taskId, content.html) : undefined;
    const text = parseTaskText(
      rawTitle ?? prepared.task.title,
      rich?.description ?? description ?? prepared.task.description
    );
    const order = position ? { sortOrder: await taskPositionOrder(ctx, prepared.task, position) } : {};
    const contentChanged = rich ? await writeDescription(ctx, prepared.task, prepared.user._id, rich) : false;
    if (description !== undefined) await syncPlainDescription(ctx, prepared.task, description, prepared.user._id);
    const relationships = await applyRelationshipUpdate(ctx, preparedRelationships);
    const changed = contentChanged || relationships.changed;
    const propertiesChanged = await applyPropertyUpdate(
      ctx,
      prepared,
      { ...text, ...order },
      changed ? { kind: "updated", changes: relationships.changes } : undefined
    );
    if (changed && !propertiesChanged)
      await taskChanged(ctx, prepared.task, prepared.user._id, { kind: "updated", changes: relationships.changes });
    return taskId;
  },
});
export const setTitle = mutation({
  args: { taskId: v.id("tasks"), expectedTitleUpdatedAt: v.number(), title: v.string() },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId);
    const { user } = await requireProject(ctx, task.projectId, true);
    if (!Number.isSafeInteger(args.expectedTitleUpdatedAt) || args.expectedTitleUpdatedAt !== task.titleUpdatedAt)
      throw new ConvexError("This title changed while you were editing. Reopen the latest title before saving.");
    const { title } = parseTaskText(args.title, task.description);
    if (title === task.title) return { titleUpdatedAt: task.titleUpdatedAt, title };
    await ctx.db.patch(task._id, { title });
    const titleUpdatedAt = await taskChanged(ctx, task, user._id);
    return { titleUpdatedAt, title };
  },
});
