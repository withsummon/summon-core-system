import { mergedStream, stream } from "convex-helpers/server/stream";
import { convexToZod, zid, zodToConvex } from "convex-helpers/server/zod4";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v, type Infer } from "convex/values";
import { z } from "zod/v4";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { date, pageBudget } from "../commercial/validation";
import { requireWorkspace } from "../identity/access";
import { personalImageDescriptor, userAppearance } from "../identity/avatar_owner";
import { defaultProfile } from "../identity/profile_owner";
import { renderedProjectLogo } from "../projects/branding_schema";
import { projectReader, projectSummary } from "../savedViews/scope";
import schema from "../schema";
import { taskIsActive, taskRoleCanRead } from "./access";
import { requireUsableLabel } from "./label_access";
import { priority, status } from "./schema";

const conditionFields = { id: z.string(), type: z.literal("condition") };
const calendarDate = z.string().transform((value) => {
  date(value);
  return value;
});
const dateProperty = z.enum(["startDate", "targetDate"]);
const profileCondition = z.union([
  z.object({
    ...conditionFields,
    property: z.literal("priority"),
    operator: z.literal("exact"),
    value: convexToZod(priority),
  }),
  z.object({
    ...conditionFields,
    property: z.literal("priority"),
    operator: z.literal("in"),
    value: z.array(convexToZod(priority)).min(1),
  }),
  z.object({
    ...conditionFields,
    property: z.literal("status"),
    operator: z.literal("exact"),
    value: convexToZod(status),
  }),
  z.object({
    ...conditionFields,
    property: z.literal("status"),
    operator: z.literal("in"),
    value: z.array(convexToZod(status)).min(1),
  }),
  z.object({
    ...conditionFields,
    property: z.literal("labelId"),
    operator: z.literal("exact"),
    value: zid("taskLabels"),
  }),
  z.object({
    ...conditionFields,
    property: z.literal("labelId"),
    operator: z.literal("in"),
    value: z.array(zid("taskLabels")).min(1),
  }),
  z.object({ ...conditionFields, property: dateProperty, operator: z.literal("exact"), value: calendarDate }),
  z.object({
    ...conditionFields,
    property: dateProperty,
    operator: z.literal("range"),
    value: z.tuple([calendarDate, calendarDate]).refine(([from, to]) => from <= to, "Date range is reversed."),
  }),
]);
const filterGroup = z.object({ id: z.string(), type: z.literal("group"), logicalOperator: z.literal("and") });
// The inherited public filter API counts the root as depth one and permits five levels.
// Finite composition keeps every native validator and generated argument precise.
const filterDepth2 = z.union([profileCondition, filterGroup.extend({ children: z.array(profileCondition).min(1) })]);
const filterDepth3 = z.union([profileCondition, filterGroup.extend({ children: z.array(filterDepth2).min(1) })]);
const filterDepth4 = z.union([profileCondition, filterGroup.extend({ children: z.array(filterDepth3).min(1) })]);
const profileExpression = z
  .union([profileCondition, filterGroup.extend({ children: z.array(filterDepth4).min(1) })])
  .nullable();
const profileGroup = v.union(
  v.null(),
  v.object({ by: v.literal("status"), value: status }),
  v.object({ by: v.literal("priority"), value: priority }),
  v.object({ by: v.literal("projectId"), value: v.id("projects") }),
  v.object({ by: v.literal("labelId"), value: v.union(v.id("taskLabels"), v.null()) })
);
const profileOrder = v.union(
  v.literal("sortOrder"),
  v.literal("createdAt"),
  v.literal("updatedAt"),
  v.literal("startDate"),
  v.literal("priority")
);
const ordering = {
  sortOrder: { index: "by_workspace_manual", direction: "asc" },
  createdAt: { index: "by_workspace", direction: "desc" },
  updatedAt: { index: "by_workspace_updated", direction: "desc" },
  startDate: { index: "by_workspace_start_date", direction: "asc" },
  priority: { index: "by_workspace_priority", direction: "asc" },
} satisfies Record<
  Infer<typeof profileOrder>,
  { index: keyof DataModel["tasks"]["indexes"]; direction: "asc" | "desc" }
>;

function profileConditions(expression: z.infer<typeof profileExpression>): z.infer<typeof profileCondition>[] {
  if (expression === null) return [];
  return expression.type === "condition" ? [expression] : expression.children.flatMap(profileConditions);
}
function matchesCondition(task: Doc<"tasks">, condition: z.infer<typeof profileCondition>) {
  switch (condition.property) {
    case "priority":
    case "status":
      return condition.operator === "exact"
        ? task[condition.property] === condition.value
        : condition.value.some((value) => value === task[condition.property]);
    case "labelId":
      return condition.operator === "exact"
        ? task.labelIds.includes(condition.value)
        : condition.value.some((id) => task.labelIds.includes(id));
    case "startDate":
    case "targetDate": {
      const value = task[condition.property];
      if (value === null) return false;
      return condition.operator === "exact"
        ? value === condition.value
        : value >= condition.value[0] && value <= condition.value[1];
    }
  }
}
function matchesGroup(task: Doc<"tasks">, group: Infer<typeof profileGroup>) {
  if (group === null) return true;
  switch (group.by) {
    case "status":
      return task.status === group.value;
    case "priority":
      return task.priority === group.value;
    case "projectId":
      return task.projectId === group.value;
    case "labelId":
      return group.value === null ? task.labelIds.length === 0 : task.labelIds.includes(group.value);
  }
}

// Canonical rows own the counts. A project membership contributes its metadata
// even when it has no tasks; task rows contribute only their actual relationships.
function projectContribution(
  project: Doc<"projects">,
  task: Doc<"tasks"> | null,
  subjectId: Id<"users">,
  subscribed: boolean
) {
  const active = task !== null && taskIsActive(task);
  const assigned = active && task.assigneeIds.includes(subjectId);
  return {
    projectId: project._id,
    name: project.name,
    identifier: project.identifier,
    logo: renderedProjectLogo(project.logoProps ?? {}),
    createdCount: Number(active && task.createdBy === subjectId),
    assignedCount: Number(assigned),
    subscribedCount: Number(subscribed),
    completedByTimestamp: Number(assigned && task.completedAt !== null),
    completedCount: Number(assigned && task.status === "done"),
    pendingCount: Number(assigned && task.status !== "done" && task.status !== "cancelled"),
    statusDistribution: status.members.map(({ value }) => ({
      status: value,
      count: Number(assigned && task.status === value),
    })),
    priorityDistribution: priority.members.map(({ value }) => ({
      priority: value,
      count: Number(assigned && task.priority === value),
    })),
  };
}

const subjectArgs = { workspaceId: v.id("workspaces"), userId: v.string() };
export async function requireSubject(ctx: QueryCtx, workspaceId: Id<"workspaces">, rawUserId: string) {
  const access = await requireWorkspace(ctx, workspaceId);
  const userId = ctx.db.normalizeId("users", rawUserId);
  if (!userId) throw new ConvexError("Workspace member not found.");
  const [target, membership] = await Promise.all([
    ctx.db.get(userId),
    ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId).eq("userId", userId))
      .unique(),
  ]);
  if (!target || !membership?.active) throw new ConvexError("Workspace member not found.");
  return { access, target };
}

/** Workspace-visible identity only; private account settings stay self-only. */
export const subject = query({
  args: subjectArgs,
  handler: async (ctx, args) => {
    const { access, target } = await requireSubject(ctx, args.workspaceId, args.userId);
    const [storedProfile, appearance] = await Promise.all([
      ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", target._id))
        .unique(),
      userAppearance(ctx, target._id),
    ]);
    const profile = storedProfile ?? defaultProfile;
    const [avatar, cover] = await Promise.all([
      personalImageDescriptor(ctx, appearance, "avatar", args.workspaceId),
      personalImageDescriptor(ctx, appearance, "cover", args.workspaceId),
    ]);
    return {
      userId: target._id,
      displayName: target.name ?? null,
      firstName: profile.firstName,
      lastName: profile.lastName,
      timezone: profile.timezone,
      accountCreatedAt: target._creationTime,
      avatar,
      cover,
      externalCoverUrl: appearance?.externalCoverUrl ?? null,
      canEditProfile: access.user._id === target._id,
      canViewTaskTabs: access.member.role !== "guest",
      canExportActivity: access.member.role !== "guest",
    };
  },
});

/** One selected group per native cursor. Group catalogs and global counts are
 * separate owners; this page never derives them from loaded task rows. */
export const list = query({
  args: {
    ...subjectArgs,
    view: v.union(v.literal("assigned"), v.literal("created"), v.literal("subscribed")),
    order: profileOrder,
    includeSubtasks: v.boolean(),
    filters: zodToConvex(profileExpression),
    group: profileGroup,
    subgroup: profileGroup,
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { access, target } = await requireSubject(ctx, args.workspaceId, args.userId);
    if (access.member.role === "guest") throw new ConvexError("Only workspace members can view profile task tabs.");
    const parsed = profileExpression.safeParse(args.filters);
    if (!parsed.success) throw new ConvexError(z.prettifyError(parsed.error));
    const conditions = profileConditions(parsed.data);
    if (args.group && args.subgroup && args.group.by === args.subgroup.by)
      throw new ConvexError("Group and subgroup must use different properties.");
    const read = projectReader(ctx, args.workspaceId, access.user._id);
    const labelIds = new Set(
      conditions.flatMap((condition) =>
        condition.property === "labelId" ? (condition.operator === "exact" ? [condition.value] : condition.value) : []
      )
    );
    await Promise.all(
      [args.group, args.subgroup].map(async (group) => {
        if (group?.by === "labelId" && group.value !== null) labelIds.add(group.value);
        if (group?.by === "projectId" && !(await read(group.value)))
          throw new ConvexError("Choose a group from an accessible project.");
      })
    );
    await Promise.all(
      [...labelIds].map(async (labelId) => {
        const label = await requireUsableLabel(ctx, labelId);
        if (!(await read(label.projectId))) throw new ConvexError("Choose a label from an accessible project.");
      })
    );
    const selectedOrder = ordering[args.order];
    return stream(ctx.db, schema)
      .query("tasks")
      .withIndex(selectedOrder.index, (q) => q.eq("workspaceId", args.workspaceId))
      .order(selectedOrder.direction)
      .map(async (task) => {
        if (
          !taskIsActive(task) ||
          !conditions.every((condition) => matchesCondition(task, condition)) ||
          !matchesGroup(task, args.group) ||
          !matchesGroup(task, args.subgroup)
        )
          return null;
        const scope = await read(task.projectId);
        if (
          !scope ||
          !taskRoleCanRead(
            task,
            access.user._id,
            access.member.role,
            scope.member.role,
            !!scope.project.guestViewAllFeatures
          )
        )
          return null;
        if (args.view === "assigned" && !task.assigneeIds.includes(target._id)) return null;
        if (args.view === "created" && task.createdBy !== target._id) return null;
        if (
          args.view === "subscribed" &&
          !(await ctx.db
            .query("taskSubscriptions")
            .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", target._id))
            .unique())
        )
          return null;
        if (
          !args.includeSubtasks &&
          (await ctx.db
            .query("taskParents")
            .withIndex("by_child", (q) => q.eq("childId", task._id))
            .unique())
        )
          return null;
        return { task, project: projectSummary(scope.project) };
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});

/** Exact contributions from canonical rows; global totals require exhausting
 * the helpers React paginator on one consistent Convex client. */
export const summary = query({
  args: { ...subjectArgs, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { access, target } = await requireSubject(ctx, args.workspaceId, args.userId);
    const read = projectReader(ctx, args.workspaceId, access.user._id);
    const database = stream(ctx.db, schema);
    const tasks = database
      .query("tasks")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .map(async (task) => {
        if (task.deletedAt !== null) return null;
        const scope = await read(task.projectId);
        if (
          !scope ||
          !taskRoleCanRead(
            task,
            access.user._id,
            access.member.role,
            scope.member.role,
            !!scope.project.guestViewAllFeatures
          )
        )
          return null;
        const subscription = await ctx.db
          .query("taskSubscriptions")
          .withIndex("by_task_user", (q) => q.eq("taskId", task._id).eq("userId", target._id))
          .unique();
        const contribution = projectContribution(scope.project, task, target._id, subscription !== null);
        return contribution.createdCount || contribution.assignedCount || contribution.subscribedCount
          ? contribution
          : null;
      });
    const projects = database
      .query("projectMembers")
      .withIndex("by_workspace_user_active", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", access.user._id).eq("active", true)
      )
      .order("desc")
      .map(async (member) => {
        const scope = await read(member.projectId);
        return scope ? projectContribution(scope.project, null, target._id, false) : null;
      });
    const result = await mergedStream([tasks, projects], ["_creationTime"]).paginate(pageBudget(args.paginationOpts));
    return { ...result, coverage: "page" as const };
  },
});
