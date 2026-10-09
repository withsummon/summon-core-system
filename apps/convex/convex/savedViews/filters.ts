import { taskStateIsSelectable, taskCondition, taskExpression, dateRange } from "../tasks/schema";
import { requireUsableLabel } from "../tasks/label_access";
import { ConvexError, type Infer } from "convex/values";
import { z } from "zod/v4";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { date } from "../commercial/validation";
import { projectReader } from "./scope";
import { readTaskCycle } from "../cycles/tasks";
import { readTaskModules } from "../modules/tasks";
import { memberIdentity } from "../projects/directory";
type Filters = z.infer<typeof taskExpression>;
export function filterConditions(filters: Filters): z.infer<typeof taskCondition>[] {
  if (filters === null) return [];
  return filters.type === "condition" ? [filters] : filters.children.flatMap(filterConditions);
}
export function filterReferences(filters: Filters) {
  const conditions = filterConditions(filters);
  return {
    users: [
      ...new Set(
        conditions
          .filter((c) => c.property === "assigneeId" || c.property === "createdBy" || c.property === "subscriberId")
          .flatMap((c) => (c.operator === "exact" ? [c.value] : c.value))
      ),
    ],
    states: [
      ...new Set(
        conditions
          .filter((c) => c.property === "stateId")
          .flatMap((c) => (c.operator === "exact" ? [c.value] : c.value))
      ),
    ],
    labels: [
      ...new Set(
        conditions
          .filter((c) => c.property === "labelId")
          .flatMap((c) => (c.operator === "exact" ? [c.value] : c.value))
      ),
    ],
    projects: [
      ...new Set(
        conditions
          .filter((c) => c.property === "projectId")
          .flatMap((c) => (c.operator === "exact" ? [c.value] : c.value))
      ),
    ],
    cycles: [
      ...new Set(
        conditions
          .filter((c) => c.property === "cycleId")
          .flatMap((c) => (c.operator === "exact" ? [c.value] : c.value))
      ),
    ],
    modules: [
      ...new Set(
        conditions
          .filter((c) => c.property === "moduleId")
          .flatMap((c) => (c.operator === "exact" ? [c.value] : c.value))
      ),
    ],
  };
}
export function checkRange(range: Infer<typeof dateRange>) {
  if (!range) return;
  date(range.from);
  date(range.to);
  if (range.from === null && range.to === null)
    throw new ConvexError("Choose at least one date boundary or remove the date filter.");
  if (range.from && range.to && range.from > range.to) throw new ConvexError("Date range is reversed.");
}
export function inRange(value: string | null, range: NonNullable<Infer<typeof dateRange>>) {
  return value !== null && (!range.from || value >= range.from) && (!range.to || value <= range.to);
}
export function validateShape(filters: Filters) {
  const parsed = taskExpression.safeParse(filters);
  if (!parsed.success) throw new ConvexError(z.prettifyError(parsed.error));
  for (const condition of filterConditions(parsed.data)) {
    if (
      condition.operator === "in" &&
      (condition.value.length > 50 || new Set<string>(condition.value).size !== condition.value.length)
    )
      throw new ConvexError("Choose up to 50 distinct values per filter.");
  }
  const references = filterReferences(parsed.data);
  if (Object.values(references).reduce((total, ids) => total + ids.length, 0) > 100)
    throw new ConvexError("Choose at most 100 referenced filter values.");
  return parsed.data;
}
export async function validateFilters(ctx: QueryCtx, projectId: Id<"projects">, filters: Filters) {
  const parsed = validateShape(filters);
  const references = filterReferences(parsed);
  await Promise.all(
    references.states.map(async (id) => {
      const row = await ctx.db.get(id);
      if (!row || row.projectId !== projectId || !taskStateIsSelectable(row))
        throw new ConvexError("States must belong to this project and cannot be triage.");
    })
  );
  await Promise.all(
    references.labels.map(async (id) => {
      const row = await requireUsableLabel(ctx, id);
      if (row.projectId !== projectId) throw new ConvexError("Labels must belong to this project.");
    })
  );
  await Promise.all(
    [...references.cycles, ...references.modules].map(async (id) => {
      const row = await ctx.db.get(id);
      if (!row || row.projectId !== projectId) throw new ConvexError("Cycles and modules must belong to this project.");
    })
  );
  if (references.projects.some((id) => id !== projectId))
    throw new ConvexError("Choose this project for a project view.");
  await Promise.all(
    references.users.map(async (userId) => {
      const row = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
        .unique();
      if (!row) throw new ConvexError("Filter users must belong to this project.");
    })
  );
  return parsed;
}
async function matchesCondition(ctx: QueryCtx, task: Doc<"tasks">, condition: z.infer<typeof taskCondition>) {
  switch (condition.property) {
    case "priority":
    case "status":
    case "stateId":
    case "projectId":
    case "createdBy":
      return condition.operator === "exact"
        ? task[condition.property] === condition.value
        : condition.value.some((value) => value === task[condition.property]);
    case "assigneeId":
      return condition.operator === "exact"
        ? task.assigneeIds.includes(condition.value)
        : condition.value.some((id) => task.assigneeIds.includes(id));
    case "labelId":
      return condition.operator === "exact"
        ? task.labelIds.includes(condition.value)
        : condition.value.some((id) => task.labelIds.includes(id));
    case "subscriberId": {
      const ids = condition.operator === "exact" ? [condition.value] : condition.value;
      return (
        await Promise.all(
          ids.map((id) =>
            ctx.db
              .query("taskSubscriptions")
              .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", id))
              .unique()
          )
        )
      ).some((row) => row !== null);
    }
    case "cycleId": {
      const { cycle } = await readTaskCycle(ctx, task);
      return (
        cycle !== null &&
        (condition.operator === "exact" ? cycle._id === condition.value : condition.value.includes(cycle._id))
      );
    }
    case "moduleId": {
      const modules = await readTaskModules(ctx, task);
      return modules.some(({ module }) =>
        condition.operator === "exact" ? module._id === condition.value : condition.value.includes(module._id)
      );
    }
    case "startDate":
    case "targetDate": {
      const value = task[condition.property];
      if (value === null) return false;
      switch (condition.operator) {
        case "exact":
          return value === condition.value;
        case "range":
          return value >= condition.value[0] && value <= condition.value[1];
        case "gte":
          return value >= condition.value;
        case "lte":
          return value <= condition.value;
      }
    }
  }
}
export async function matchesFilters(ctx: QueryCtx, task: Doc<"tasks">, filters: Filters): Promise<boolean> {
  if (filters === null) return true;
  if (filters.type === "condition") return matchesCondition(ctx, task, filters);
  const matches = await Promise.all(filters.children.map((child) => matchesFilters(ctx, task, child)));
  return filters.logicalOperator === "and" ? matches.every(Boolean) : matches.some(Boolean);
}
export async function validateWorkspaceFilters(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
  filters: Filters
) {
  const parsed = validateShape(filters);
  const references = filterReferences(parsed);
  const read = projectReader(ctx, workspaceId, userId);
  await Promise.all(
    references.states.map(async (id) => {
      const row = await ctx.db.get(id);
      if (!row || !taskStateIsSelectable(row) || !(await read(row.projectId)))
        throw new ConvexError("Choose a state from an accessible project.");
    })
  );
  await Promise.all(
    references.labels.map(async (id) => {
      const row = await requireUsableLabel(ctx, id);
      if (row.projectId === null || !(await read(row.projectId)))
        throw new ConvexError("Choose a label from an accessible project.");
    })
  );
  await Promise.all(
    [...references.cycles, ...references.modules].map(async (id) => {
      const row = await ctx.db.get(id);
      if (!row || !(await read(row.projectId)))
        throw new ConvexError("Choose a cycle or module from an accessible project.");
    })
  );
  await Promise.all(
    references.projects.map(async (id) => {
      if (!(await read(id))) throw new ConvexError("Choose an accessible project.");
    })
  );
  await Promise.all(
    references.users.map(async (id) => {
      const member = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", id))
        .unique();
      if (!member) throw new ConvexError("Filter users must belong to this workspace.");
    })
  );
  return parsed;
}
// Resolve retained selections independently of the currently loaded directory page.
export async function filterSelections(
  ctx: QueryCtx,
  view: Doc<"savedViews">,
  userId: Id<"users">,
  viewerWorkspaceRole: Doc<"workspaceMembers">["role"]
) {
  const references = filterReferences(view.filters);
  const read = projectReader(ctx, view.workspaceId, userId);
  const visible = async (projectId: Id<"projects">) =>
    view.projectId === null ? (await read(projectId)) !== null : projectId === view.projectId;
  const projectId = view.projectId;
  const users = await Promise.all(
    references.users.map(async (id) => {
      const membership =
        projectId === null
          ? null
          : await ctx.db
              .query("projectMembers")
              .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", id))
              .unique();
      const identity =
        view.projectId === null || membership?.active
          ? await memberIdentity(ctx, view.workspaceId, viewerWorkspaceRole, id, "")
          : null;
      return { id, name: identity ? identity.fullName || identity.displayName : null };
    })
  );
  const states = await Promise.all(
    references.states.map(async (id) => {
      const row = await ctx.db.get(id);
      return { id, name: row && taskStateIsSelectable(row) && (await visible(row.projectId)) ? row.name : null };
    })
  );
  const labels = await Promise.all(
    references.labels.map(async (id) => {
      const row = await ctx.db.get(id);
      return {
        id,
        name: row && row.projectId !== null && !row.retiring && (await visible(row.projectId)) ? row.name : null,
      };
    })
  );
  const cycles = await Promise.all(
    references.cycles.map(async (id) => {
      const row = await ctx.db.get(id);
      return { id, name: row && !row.deleted && (await visible(row.projectId)) ? row.name : null };
    })
  );
  const modules = await Promise.all(
    references.modules.map(async (id) => {
      const row = await ctx.db.get(id);
      return { id, name: row && !row.deleted && (await visible(row.projectId)) ? row.name : null };
    })
  );
  const projects = await Promise.all(
    references.projects.map(async (id) => {
      const permission = await read(id);
      return {
        id,
        name: permission && (view.projectId === null || id === view.projectId) ? permission.project.name : null,
      };
    })
  );
  return { users, states, labels, cycles, modules, projects };
}
