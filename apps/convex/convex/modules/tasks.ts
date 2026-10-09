import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v, ConvexError, type Infer } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { mutation, query } from "../_generated/server";
import { requireTask, taskIsActive, taskCanRead, taskDetail, taskOrdering } from "../tasks/access";
import { requireProject } from "../identity/access";
import { requireTaskRevision, taskChanged, indexTaskModuleName } from "../tasks/revision";
import { pageBudget } from "../commercial/validation";
import { requireModule, requireModuleRevision, requireEditableModule } from "./access";
import { draftFields, validateModuleReferences } from "../tasks/drafts/fields";
import { taskOrder, viewFilters } from "../tasks/schema";
import { matchesFilters, validateShape } from "../savedViews/filters";
export const set = mutation({
  args: {
    moduleId: v.id("modules"),
    taskId: v.id("tasks"),
    assigned: v.boolean(),
    expectedTaskUpdatedAt: v.number(),
    expectedModuleUpdatedAt: v.number(),
  },
  handler: setModuleTask,
});
export const setMany = mutation({
  args: {
    moduleId: v.id("modules"),
    expectedModuleUpdatedAt: v.number(),
    assigned: v.boolean(),
    tasks: v.array(v.object({ taskId: v.id("tasks"), expectedTaskUpdatedAt: v.number() })),
  },
  handler: async (ctx, args) => {
    if (
      args.tasks.length < 1 ||
      args.tasks.length > 100 ||
      new Set(args.tasks.map((task) => task.taskId)).size !== args.tasks.length
    )
      throw new ConvexError("Choose between 1 and 100 distinct work items per operation.");
    await Promise.all(
      args.tasks.map((task) =>
        setModuleTask(ctx, {
          moduleId: args.moduleId,
          expectedModuleUpdatedAt: args.expectedModuleUpdatedAt,
          assigned: args.assigned,
          ...task,
        })
      )
    );
  },
});
export const list = query({
  args: {
    moduleId: v.id("modules"),
    filters: v.optional(viewFilters),
    order: v.optional(taskOrder),
    includeSubtasks: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireModule(ctx, args.moduleId);
    const { module, user, member, projectMember } = access;
    const canDetach = member.role !== "guest" && projectMember.role !== "guest" && !module.archived;
    if (args.filters) validateShape(args.filters);
    const source = stream(ctx.db, schema);
    const ordering = taskOrdering[args.order ?? "createdAt"];
    const tasks =
      args.order === undefined
        ? source
            .query("moduleTasks")
            .withIndex("by_module_task", (q) => q.eq("moduleId", module._id))
            .map((row) => ctx.db.get(row.taskId))
        : args.order === "createdAt"
          ? source
              .query("tasks")
              .withIndex("by_project", (q) => q.eq("projectId", module.projectId))
              .order("desc")
          : args.order === "updatedAt"
            ? source
                .query("tasks")
                .withIndex("by_project_updated", (q) => q.eq("projectId", module.projectId))
                .order("desc")
            : source
                .query("tasks")
                .withIndex(ordering.index, (q) => q.eq("workspaceId", module.workspaceId))
                .order(ordering.direction);
    return tasks
      .map(async (task) => {
        if (!task || task.projectId !== module.projectId || task.workspaceId !== module.workspaceId) return null;
        if (
          args.order !== undefined &&
          !(await ctx.db
            .query("moduleTasks")
            .withIndex("by_module_task", (q) => q.eq("moduleId", module._id).eq("taskId", task._id))
            .unique())
        )
          return null;
        const readable = taskIsActive(task) && (await taskCanRead(ctx, task, user._id));
        if (!readable && !canDetach) return null;
        if (args.filters && !(await matchesFilters(ctx, task, args.filters))) return null;
        if (
          args.includeSubtasks === false &&
          (await ctx.db
            .query("taskParents")
            .withIndex("by_child", (q) => q.eq("childId", task._id))
            .unique())
        )
          return null;
        return {
          taskId: task._id,
          updatedAt: task.updatedAt,
          task: readable ? await taskDetail(ctx, task, access) : null,
          unavailable: !taskIsActive(task),
        };
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const forTask = query({
  args: { taskId: v.id("tasks"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, "read");
    await requireProject(ctx, task.projectId);
    return stream(ctx.db, schema)
      .query("moduleTasks")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .map(async (row) => {
        const module = await ctx.db.get(row.moduleId);
        return module && !module.deleted ? module : null;
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});

export async function* taskModuleMemberships(ctx: QueryCtx, task: Doc<"tasks">) {
  for await (const membership of ctx.db.query("moduleTasks").withIndex("by_task", (q) => q.eq("taskId", task._id))) {
    const module = await ctx.db.get(membership.moduleId);
    if (!module || module.projectId !== task.projectId || module.workspaceId !== task.workspaceId)
      throw new ConvexError("Module reference not found in this project.");
    yield { membership, module };
  }
}
export async function taskHasModuleName(ctx: QueryCtx, task: Doc<"tasks">, name: string | null) {
  if (name === null)
    return !(await ctx.db
      .query("moduleTasks")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .first());
  // Deleted Modules retain their real join names; do not turn this into a visible-only lookup.
  for (const deleted of [false, true]) {
    // Exit at the first real matching membership without collecting either name partition.
    // oxlint-disable-next-line no-await-in-loop
    for await (const module of ctx.db
      .query("modules")
      .withIndex("by_project_name", (q) => q.eq("projectId", task.projectId).eq("deleted", deleted).eq("name", name))) {
      if (
        await ctx.db
          .query("moduleTasks")
          .withIndex("by_module_task", (q) => q.eq("moduleId", module._id).eq("taskId", task._id))
          .unique()
      ) {
        if (module.workspaceId !== task.workspaceId)
          throw new ConvexError("Module reference not found in this project.");
        return true;
      }
    }
  }
  return false;
}
export async function readTaskModules(ctx: QueryCtx, task: Doc<"tasks">) {
  const source = [];
  for await (const row of taskModuleMemberships(ctx, task)) {
    source.push(row);
    if (source.length > 100) throw new ConvexError("A work item can edit at most 100 module memberships at once.");
  }
  return source;
}
export async function currentTaskModules(ctx: QueryCtx, task: Doc<"tasks">) {
  const source = await readTaskModules(ctx, task);
  return {
    modules: source.filter(({ module }) => !module.deleted).map(({ module }) => module),
    references: source.map(({ module }) => ({ moduleId: module._id, expectedModuleUpdatedAt: module.updatedAt })),
  };
}
export async function prepareModuleTask(
  ctx: MutationCtx,
  args: {
    moduleId: Id<"modules">;
    taskId: Id<"tasks">;
    assigned: boolean;
    expectedTaskUpdatedAt: number;
    expectedModuleUpdatedAt: number;
  }
) {
  const { module, user } = await requireModule(ctx, args.moduleId, true, !args.assigned);
  if (!module.deleted) requireEditableModule(module);
  requireModuleRevision(module, args.expectedModuleUpdatedAt);
  const task = args.assigned ? await requireTask(ctx, args.taskId) : await ctx.db.get(args.taskId);
  if (!task) throw new ConvexError("Task not found.");
  if (task.projectId !== module.projectId) throw new ConvexError("Task belongs to another project.");
  const previous = await ctx.db
    .query("moduleTasks")
    .withIndex("by_module_task", (q) => q.eq("moduleId", module._id).eq("taskId", task._id))
    .unique();
  if (Boolean(previous) === args.assigned) return null;
  requireTaskRevision(task, args.expectedTaskUpdatedAt);
  return { task, user, module, previous, assigned: args.assigned };
}
export async function prepareModuleChanges(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  previous: Infer<typeof draftFields.modules>,
  next: Infer<typeof draftFields.modules>
) {
  validateModuleReferences(previous);
  validateModuleReferences(next);
  const source = await readTaskModules(ctx, task);
  if (
    source.length !== previous.length ||
    source.some(({ module }) => !previous.some((ref) => ref.moduleId === module._id))
  )
    throw new ConvexError("Module memberships changed. Reopen the work item before saving.");
  await Promise.all(
    previous.map(async (ref) => {
      const { module } = await requireModule(ctx, ref.moduleId, true, true);
      requireModuleRevision(module, ref.expectedModuleUpdatedAt);
    })
  );
  await Promise.all(
    next.map(async (ref) => {
      const { module } = await requireModule(ctx, ref.moduleId, true, true);
      if (module.projectId !== task.projectId) throw new ConvexError("Task belongs to another project.");
      requireModuleRevision(module, ref.expectedModuleUpdatedAt);
    })
  );
  const added = next.filter((ref) => !previous.some((old) => old.moduleId === ref.moduleId));
  const removed = previous.filter((ref) => !next.some((chosen) => chosen.moduleId === ref.moduleId));
  const prepared = await Promise.all([
    ...added.map((ref) =>
      prepareModuleTask(ctx, { ...ref, taskId: task._id, expectedTaskUpdatedAt: task.updatedAt, assigned: true })
    ),
    ...removed.map((ref) =>
      prepareModuleTask(ctx, { ...ref, taskId: task._id, expectedTaskUpdatedAt: task.updatedAt, assigned: false })
    ),
  ]);
  return prepared.filter((change) => change !== null);
}
export async function applyModuleTask(
  ctx: MutationCtx,
  prepared: NonNullable<Awaited<ReturnType<typeof prepareModuleTask>>>
): Promise<NonNullable<Doc<"taskEvents">["changes"]>> {
  const { module, task, previous, assigned } = prepared;
  if (assigned) await ctx.db.insert("moduleTasks", { moduleId: module._id, taskId: task._id });
  else if (previous) await ctx.db.delete(previous._id);
  return [
    {
      field: "modules",
      added: assigned ? [{ id: module._id, name: module.name }] : [],
      removed: assigned ? [] : [{ id: module._id, name: module.name }],
    },
  ];
}
export async function setModuleTask(ctx: MutationCtx, args: Parameters<typeof prepareModuleTask>[1]) {
  const prepared = await prepareModuleTask(ctx, args);
  if (prepared) {
    const changes = await applyModuleTask(ctx, prepared);
    await Promise.all([
      indexTaskModuleName(ctx, prepared.task, prepared.module.name),
      indexTaskModuleName(ctx, prepared.task, null),
    ]);
    await taskChanged(ctx, prepared.task, prepared.user._id, { kind: "updated", changes });
  }
}
