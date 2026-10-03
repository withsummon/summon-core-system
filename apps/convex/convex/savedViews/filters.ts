import { requireUsableLabel } from "../tasks/label_access";
import { ConvexError, type Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { date } from "../commercial/validation";
import { projectReader } from "./scope";
import { viewFilters } from "./schema";
type Filters = Infer<typeof viewFilters>;
function checkRange(range: Filters["startDate"]) {
  if (!range) return;
  date(range.from);
  date(range.to);
  if (range.from === null && range.to === null)
    throw new ConvexError("Choose at least one date boundary or remove the date filter.");
  if (range.from && range.to && range.from > range.to) throw new ConvexError("Date range is reversed.");
}
function validateShape(filters: Filters) {
  const selections = [
    filters.statuses,
    filters.stateIds,
    filters.priorities,
    filters.assigneeIds,
    filters.labelIds,
    filters.creatorIds,
  ];
  for (const values of selections)
    if (values.length > 50 || new Set<string>(values).size !== values.length)
      throw new ConvexError("Choose up to 50 distinct values per filter.");
  const users = [...new Set([...filters.assigneeIds, ...filters.creatorIds])];
  if (users.length + filters.stateIds.length + filters.labelIds.length > 100)
    throw new ConvexError("Choose at most 100 referenced filter values.");
  checkRange(filters.startDate);
  checkRange(filters.targetDate);
  return users;
}
export async function validateFilters(ctx: QueryCtx, projectId: Id<"projects">, filters: Filters) {
  const users = validateShape(filters);
  await Promise.all(
    filters.stateIds.map(async (id) => {
      const row = await ctx.db.get(id);
      if (!row || row.projectId !== projectId || row.status === "triage")
        throw new ConvexError("States must belong to this project and cannot be triage.");
    })
  );
  await Promise.all(
    filters.labelIds.map(async (id) => {
      const row = await requireUsableLabel(ctx, id);
      if (!row || row.projectId !== projectId) throw new ConvexError("Labels must belong to this project.");
    })
  );
  await Promise.all(
    users.map(async (userId) => {
      const row = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
        .unique();
      if (!row) throw new ConvexError("Filter users must belong to this project.");
    })
  );
  return filters;
}
function inRange(value: string | null, range: NonNullable<Filters["startDate"]>) {
  return value !== null && (!range.from || value >= range.from) && (!range.to || value <= range.to);
}
export function matchesFilters(task: Doc<"tasks">, filters: Filters) {
  const fields: [number, boolean][] = [
    [filters.statuses.length, filters.statuses.some((value) => value === task.status)],
    [filters.stateIds.length, filters.stateIds.some((value) => value === task.stateId)],
    [filters.priorities.length, filters.priorities.includes(task.priority)],
    [filters.assigneeIds.length, task.assigneeIds.some((id) => filters.assigneeIds.includes(id))],
    [filters.labelIds.length, task.labelIds.some((id) => filters.labelIds.includes(id))],
    [filters.creatorIds.length, filters.creatorIds.includes(task.createdBy)],
  ];
  const matches = fields.filter(([size]) => size > 0).map(([, matched]) => matched);
  if (filters.startDate) matches.push(inRange(task.startDate, filters.startDate));
  if (filters.targetDate) matches.push(inRange(task.targetDate, filters.targetDate));
  if (matches.length === 0) return true;
  return filters.match === "all" ? matches.every(Boolean) : matches.some(Boolean);
}

// Keep saved selections visible without relying on a currently loaded directory page.
export async function filterSelections(ctx: QueryCtx, view: Doc<"savedViews"> & { projectId: Id<"projects"> }) {
  const users = await Promise.all(
    [...new Set([...view.filters.assigneeIds, ...view.filters.creatorIds])].map(async (id) => {
      const membership = await ctx.db
        .query("projectMembers")
        .withIndex("by_project_user", (q) => q.eq("projectId", view.projectId).eq("userId", id))
        .unique();
      const user = membership ? await ctx.db.get(id) : null;
      return { id, name: user?.name ?? null };
    })
  );
  const states = await Promise.all(
    view.filters.stateIds.map(async (id) => {
      const state = await ctx.db.get(id);
      return { id, name: state?.projectId === view.projectId ? state.name : null };
    })
  );
  const labels = await Promise.all(
    view.filters.labelIds.map(async (id) => {
      const label = await ctx.db.get(id);
      return { id, name: label?.projectId === view.projectId ? label.name : null };
    })
  );
  return { users, states, labels };
}

export async function validateWorkspaceFilters(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  userId: Id<"users">,
  filters: Filters
) {
  const users = validateShape(filters);
  const read = projectReader(ctx, workspaceId, userId);
  await Promise.all(
    filters.stateIds.map(async (id) => {
      const row = await ctx.db.get(id);
      if (!row || row.status === "triage" || !(await read(row.projectId)))
        throw new ConvexError("Choose a state from an accessible project.");
    })
  );
  await Promise.all(
    filters.labelIds.map(async (id) => {
      const row = await requireUsableLabel(ctx, id);
      if (!row || !(await read(row.projectId))) throw new ConvexError("Choose a label from an accessible project.");
    })
  );
  await Promise.all(
    users.map(async (id) => {
      const member = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", id))
        .unique();
      if (!member) throw new ConvexError("Filter users must belong to this workspace.");
    })
  );
  return filters;
}
export async function workspaceFilterSelections(
  ctx: QueryCtx,
  view: Doc<"savedViews"> & { workspaceId: Id<"workspaces"> },
  userId: Id<"users">
) {
  const read = projectReader(ctx, view.workspaceId, userId);
  const users = await Promise.all(
    [...new Set([...view.filters.assigneeIds, ...view.filters.creatorIds])].map(async (id) => {
      const member = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", view.workspaceId).eq("userId", id))
        .unique();
      const user = member?.active ? await ctx.db.get(id) : null;
      return { id, name: user?.name ?? null };
    })
  );
  const states = await Promise.all(
    view.filters.stateIds.map(async (id) => {
      const row = await ctx.db.get(id);
      return { id, name: row && (await read(row.projectId)) ? row.name : null };
    })
  );
  const labels = await Promise.all(
    view.filters.labelIds.map(async (id) => {
      const row = await ctx.db.get(id);
      return { id, name: row && !row.retiring && (await read(row.projectId)) ? row.name : null };
    })
  );
  return { users, states, labels };
}
