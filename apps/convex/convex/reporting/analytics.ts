import { paginationOptsValidator } from "convex/server";
import type { PaginationResult } from "convex/server";
import { ConvexError, v, type Infer } from "convex/values";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireProjectForUser, requireWorkspace } from "../identity/access";
import { projectReader } from "../savedViews/scope";
import { canDiscover, storedNetwork } from "../projects/network_access";
import { renderedProjectLogo } from "../projects/branding_schema";
import { directoryPerson } from "../projects/directory";
import { readTaskCycle } from "../cycles/tasks";
import { readTaskModules } from "../modules/tasks";
import { taskIsActive } from "../tasks/access";
import { pageBudget, pageResult } from "./scope";

const scope = v.object({
  workspaceId: v.id("workspaces"),
  projectIds: v.array(v.id("projects")),
  focus: v.union(
    v.null(),
    v.object({
      projectId: v.id("projects"),
      cycleId: v.union(v.id("cycles"), v.null()),
      moduleId: v.union(v.id("modules"), v.null()),
    })
  ),
});
const pageArgs = { scope, paginationOpts: paginationOptsValidator };
const axis = v.union(
  v.literal("stateId"),
  v.literal("status"),
  v.literal("priority"),
  v.literal("labelId"),
  v.literal("assigneeId"),
  v.literal("estimatePointId"),
  v.literal("cycleId"),
  v.literal("moduleId"),
  v.literal("completedAt"),
  v.literal("targetDate"),
  v.literal("startDate"),
  v.literal("createdAt")
);
function emptyCounts() {
  return { total: 0, backlog: 0, todo: 0, in_progress: 0, done: 0, cancelled: 0 };
}
function projectMetadata(project: Doc<"projects">) {
  return {
    id: project._id,
    name: project.name,
    identifier: project.identifier,
    logo: renderedProjectLogo(project.logoProps ?? {}),
  };
}
async function analyticsAccess(ctx: QueryCtx, selected: Infer<typeof scope>, chart = false) {
  const access = await requireWorkspace(ctx, selected.workspaceId, selected.focus === null);
  const focused = selected.focus ? await requireProjectForUser(ctx, selected.focus.projectId, access.user) : null;
  if (focused && focused.project.workspaceId !== selected.workspaceId)
    throw new ConvexError("Project belongs to another workspace.");
  if (focused && !chart && focused.projectMember.role === "guest" && access.member.role !== "admin")
    throw new ConvexError("Only project administrators and members can read these analytics.");
  let cycle: Doc<"cycles"> | null = null;
  let module: Doc<"modules"> | null = null;
  if (selected.focus) {
    if (selected.focus.cycleId) {
      cycle = await ctx.db.get(selected.focus.cycleId);
      if (!cycle || cycle.projectId !== selected.focus.projectId)
        throw new ConvexError("Cycle not found in this project.");
    }
    if (selected.focus.moduleId) {
      module = await ctx.db.get(selected.focus.moduleId);
      if (!module || module.projectId !== selected.focus.projectId)
        throw new ConvexError("Module not found in this project.");
    }
  }
  const read = projectReader(ctx, selected.workspaceId, access.user._id);
  const selectedProjects = new Set(selected.projectIds);
  const project = (id: Id<"projects">) =>
    (selected.focus && id !== selected.focus.projectId) || (selectedProjects.size > 0 && !selectedProjects.has(id))
      ? Promise.resolve(null)
      : read(id);
  return { ...access, project, focused, cycle, module };
}
async function taskInFocus(ctx: QueryCtx, task: Doc<"tasks">, selected: Infer<typeof scope>) {
  if (selected.focus?.cycleId) {
    const source = await readTaskCycle(ctx, task);
    return source.cycle?._id === selected.focus.cycleId ? source.membership?._creationTime : null;
  }
  if (selected.focus?.moduleId) {
    const source = await readTaskModules(ctx, task);
    return source.find(({ module }) => module._id === selected.focus?.moduleId)?.membership._creationTime ?? null;
  }
  return task._creationTime;
}
function calendarDay(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}
function ordinaryTasks(
  ctx: QueryCtx,
  selected: Infer<typeof scope>,
  access: Awaited<ReturnType<typeof analyticsAccess>>
) {
  return stream(ctx.db, schema)
    .query("tasks")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", selected.workspaceId))
    .map(async (task) => {
      if (!taskIsActive(task)) return null;
      const permission = await access.project(task.projectId);
      if (!permission) return null;
      const created = await taskInFocus(ctx, task, selected);
      return created == null ? null : { task, project: permission.project, created };
    });
}

// Ordinary IssueManager cohort. Aggregate access intentionally does not expose task detail.
export const tasks = query({
  args: pageArgs,
  handler: async (ctx, args) => {
    const access = await analyticsAccess(ctx, args.scope);
    const counts = emptyCounts();
    const projectCounts = new Map<
      Id<"projects">,
      { project: ReturnType<typeof projectMetadata>; counts: ReturnType<typeof emptyCounts> }
    >();
    const assignees = new Map<
      string,
      { person: Awaited<ReturnType<typeof directoryPerson>>; counts: ReturnType<typeof emptyCounts> }
    >();
    const result = await ordinaryTasks(ctx, args.scope, access)
      .map(async ({ task, project: selectedProject }) => {
        counts.total++;
        counts[task.status]++;
        const project = projectCounts.get(task.projectId) ?? {
          project: projectMetadata(selectedProject),
          counts: emptyCounts(),
        };
        project.counts.total++;
        project.counts[task.status]++;
        projectCounts.set(task.projectId, project);
        if (args.scope.focus) {
          const people = await Promise.all(
            (task.assigneeIds.length ? [...new Set(task.assigneeIds)] : [null]).map(async (id) => ({
              key: id ?? "none",
              person: id ? await directoryPerson(ctx, id, access.workspace._id, access.member.role) : null,
            }))
          );
          for (const { key, person } of people) {
            const row = assignees.get(key) ?? {
              person,
              counts: emptyCounts(),
            };
            row.counts.total++;
            row.counts[task.status]++;
            assignees.set(key, row);
          }
        }
        return 1;
      })
      .paginate(pageBudget(args.paginationOpts));
    return pageResult(result, {
      counts,
      projects: [...projectCounts.values()],
      assignees: [...assignees].map(([key, value]) => ({ key, person: value.person, counts: value.counts })),
    });
  },
});

// ProjectGuest charts use their own read boundary; cards and assignee tables stay restricted.
export const trend = query({
  args: pageArgs,
  handler: async (ctx, args) => {
    const access = await analyticsAccess(ctx, args.scope, true);
    const daily = access.cycle !== null || access.module !== null;
    const months = new Map<string, { created: number; completed: number }>();
    // Cycle/module charts count retained bridge creation, independently of IssueManager.
    const source = daily
      ? stream(ctx.db, schema)
          .query("tasks")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", args.scope.workspaceId))
          .map(async (task) => {
            if (!(await access.project(task.projectId))) return null;
            const created = await taskInFocus(ctx, task, args.scope);
            return created == null ? null : { task, created };
          })
      : ordinaryTasks(ctx, args.scope, access);
    const result = await source
      .map(async ({ task, created }) => {
        const key = daily ? calendarDay(created) : `${calendarDay(created).slice(0, 7)}-01`;
        const row = months.get(key) ?? { created: 0, completed: 0 };
        row.created++;
        if (task.status === "done") row.completed++;
        months.set(key, row);
        return 1;
      })
      .paginate(pageBudget(args.paginationOpts));
    const period = access.cycle
      ? { from: access.cycle.startDate, to: access.cycle.endDate }
      : access.module
        ? { from: access.module.startDate, to: access.module.targetDate }
        : {
            from: `${calendarDay(access.focused?.project._creationTime ?? access.workspace._creationTime).slice(0, 7)}-01`,
            to: calendarDay(Date.now()),
          };
    return pageResult(result, {
      months: [...months].map(([key, value]) => ({ key, created: value.created, completed: value.completed })),
      ...period,
      daily,
    });
  },
});

function dimension(key: string | null, name: string | null, color: string | null = null) {
  return { key: key ?? "none", name: name || "None", color };
}
function timestampDimension(timestamp: number | null) {
  const day = timestamp === null ? null : calendarDay(timestamp);
  return [dimension(day, day)];
}
function dimensionList(values: ReturnType<typeof dimension>[]) {
  return values.length ? values : [dimension(null, null)];
}
async function dimensions(
  ctx: QueryCtx,
  task: Doc<"tasks">,
  selected: Infer<typeof axis>,
  role: Doc<"workspaceMembers">["role"]
) {
  switch (selected) {
    case "stateId": {
      const state = task.stateId ? await ctx.db.get(task.stateId) : null;
      return [
        state?.projectId === task.projectId ? dimension(state._id, state.name, state.color) : dimension(null, null),
      ];
    }
    case "status":
      return [dimension(task.status, task.status)];
    case "priority":
      return [dimension(task.priority, task.priority)];
    case "labelId":
      return Promise.all(
        [...new Set(task.labelIds)].map(async (id) => {
          const label = await ctx.db.get(id);
          return label?.projectId === task.projectId
            ? dimension(label._id, label.name, label.color)
            : dimension(null, null);
        })
      ).then(dimensionList);
    case "assigneeId":
      return Promise.all(
        [...new Set(task.assigneeIds)].map(async (id) => {
          const person = await directoryPerson(ctx, id, task.workspaceId, role);
          return dimension(id, person?.name ?? "Unavailable member");
        })
      ).then(dimensionList);
    case "estimatePointId": {
      const point = task.estimatePointId ? await ctx.db.get(task.estimatePointId) : null;
      return [point?.projectId === task.projectId ? dimension(String(point.key), point.value) : dimension(null, null)];
    }
    case "cycleId": {
      const { cycle } = await readTaskCycle(ctx, task);
      return [cycle ? dimension(cycle._id, cycle.name) : dimension(null, null)];
    }
    case "moduleId": {
      const rows = await readTaskModules(ctx, task);
      return dimensionList(rows.map(({ module }) => dimension(module._id, module.name)));
    }
    case "createdAt":
      return timestampDimension(task._creationTime);
    case "completedAt":
      return timestampDimension(task.completedAt);
    case "startDate":
      return [dimension(task.startDate, task.startDate)];
    case "targetDate":
      return [dimension(task.targetDate, task.targetDate)];
  }
}
export const chart = query({
  args: { ...pageArgs, axis, groupBy: v.union(axis, v.null()) },
  handler: async (ctx, args) => {
    const access = await analyticsAccess(ctx, args.scope, true);
    const pairs = new Map<
      string,
      { x: ReturnType<typeof dimension>; group: ReturnType<typeof dimension> | null; count: number }
    >();
    const result = await ordinaryTasks(ctx, args.scope, access)
      .map(async ({ task }) => {
        const x = await dimensions(ctx, task, args.axis, access.member.role);
        const groups = args.groupBy === null ? [null] : await dimensions(ctx, task, args.groupBy, access.member.role);
        const seen = new Set<string>();
        for (const value of x)
          for (const group of groups) {
            const key = JSON.stringify([value.key, value.name, group?.key ?? null, group?.name ?? null]);
            if (seen.has(key)) continue;
            seen.add(key);
            const pair = pairs.get(key) ?? { x: value, group, count: 0 };
            pair.count++;
            pairs.set(key, pair);
          }
        return 1;
      })
      .paginate(pageBudget(args.paginationOpts));
    return pageResult(result, [...pairs.values()]);
  },
});

async function countPage(read: Promise<PaginationResult<number>>) {
  const result = await read;
  return pageResult(
    result,
    result.page.reduce((total, value) => total + value, 0)
  );
}
export const entities = query({
  args: {
    ...pageArgs,
    cohort: v.union(
      v.literal("projects"),
      v.literal("cycles"),
      v.literal("modules"),
      v.literal("intake"),
      v.literal("pages"),
      v.literal("views")
    ),
  },
  handler: async (ctx, args) => {
    const access = await analyticsAccess(ctx, args.scope);
    const source = stream(ctx.db, schema),
      budget = pageBudget(args.paginationOpts);
    switch (args.cohort) {
      case "projects":
        return countPage(
          source
            .query("projects")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", args.scope.workspaceId))
            .map(async (project) => ((await access.project(project._id)) ? 1 : null))
            .paginate(budget)
        );
      case "cycles":
        return countPage(
          source
            .query("cycles")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", args.scope.workspaceId).eq("deleted", false))
            .map(async (cycle) => ((await access.project(cycle.projectId)) ? 1 : null))
            .paginate(budget)
        );
      case "modules":
        return countPage(
          source
            .query("modules")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", args.scope.workspaceId).eq("deleted", false))
            .map(async (module) => ((await access.project(module.projectId)) ? 1 : null))
            .paginate(budget)
        );
      case "intake":
        return countPage(
          source
            .query("tasks")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", args.scope.workspaceId))
            .map(async (task) => {
              if (task.deletedAt !== null || !(await access.project(task.projectId))) return null;
              const intake = await ctx.db
                .query("intakeTasks")
                .withIndex("by_task", (q) => q.eq("taskId", task._id))
                .unique();
              return intake?.projectId === task.projectId ? 1 : null;
            })
            .paginate(budget)
        );
      case "pages":
        return countPage(
          source
            .query("documents")
            .withIndex("by_workspace", (q) => q.eq("workspaceId", args.scope.workspaceId).eq("deleted", false))
            .map(async (document) => {
              const projects = await Promise.all([...new Set(document.projectIds)].map(access.project));
              return projects.filter((project) => project !== null).length;
            })
            .paginate(budget)
        );
      case "views":
        return countPage(
          source
            .query("savedViews")
            .withIndex("by_workspace_project_deleted", (q) => q.eq("workspaceId", args.scope.workspaceId))
            .map(async (view) =>
              view.projectId !== null && view.deletedAt === null && (await access.project(view.projectId)) ? 1 : null
            )
            .paginate(budget)
        );
    }
  },
});
export const people = query({
  args: { ...pageArgs, workspaceWide: v.boolean() },
  handler: async (ctx, args) => {
    const access = await analyticsAccess(ctx, args.scope);
    const counts = { total: 0, admin: 0, member: 0, guest: 0 };
    const source = stream(ctx.db, schema),
      budget = pageBudget(args.paginationOpts);
    const result =
      args.workspaceWide || args.scope.projectIds.length === 0
        ? await source
            .query("workspaceMembers")
            .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.scope.workspaceId))
            .map(async (row) => {
              if (!row.active || !(await ctx.db.get(row.userId))) return null;
              counts.total++;
              counts[row.role]++;
              return 1;
            })
            .paginate(budget)
        : await source
            .query("projectMembers")
            .withIndex("by_workspace_user", (q) => q.eq("workspaceId", args.scope.workspaceId))
            .map(async (row) => {
              if (!row.active || !(await access.project(row.projectId)) || !(await ctx.db.get(row.userId))) return null;
              counts.total++;
              counts[row.role]++;
              return 1;
            })
            .paginate(budget);
    return pageResult(result, counts);
  },
});

export const projects = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId, true);
    const result = await stream(ctx.db, schema)
      .query("projects")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .map(async (project) => {
        if (project.deletedAt !== null) return null;
        const member = await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", access.user._id))
          .unique();
        const joined = member?.active === true;
        return canDiscover(storedNetwork(project), access.member.role, joined)
          ? Object.assign(projectMetadata(project), { joined, archived: project.archived })
          : null;
      })
      .paginate(pageBudget(args.paginationOpts));
    return pageResult(result, result.page);
  },
});
export const activeProjects = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId, true);
    const projectCounts = new Map<Id<"projects">, { id: Id<"projects">; total: number; completed: number }>();
    const result = await stream(ctx.db, schema)
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .map(async (task) => {
        if (!taskIsActive(task)) return null;
        const project = await ctx.db.get(task.projectId);
        if (!project || project.archived || project.deletedAt !== null || project.workspaceId !== args.workspaceId)
          return null;
        const member = await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", access.user._id))
          .unique();
        if (!canDiscover(storedNetwork(project), access.member.role, member?.active === true)) return null;
        const count = projectCounts.get(project._id) ?? { id: project._id, total: 0, completed: 0 };
        count.total++;
        if (task.status === "done" || task.status === "cancelled") count.completed++;
        projectCounts.set(project._id, count);
        return 1;
      })
      .paginate(pageBudget(args.paginationOpts));
    return pageResult(result, [...projectCounts.values()]);
  },
});
