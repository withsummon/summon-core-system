import { DirectAggregate } from "@convex-dev/aggregate";
import { makeMigration } from "convex-helpers/server/migrations";
import { getFunctionName, paginationOptsValidator } from "convex/server";
import { compareValues, ConvexError, v, type Infer } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { pageBudget } from "../commercial/validation";
import { requireWorkspace } from "../identity/access";
import { personalImageDescriptor, userAppearance } from "../identity/avatar_owner";
import { defaultProfile } from "../identity/profile_owner";
import { MAX_TASK_SUBSCRIBERS } from "../notifications/schema";
import { renderedProjectLogo } from "../projects/branding_schema";
import { taskIsActive, taskRoleCanReadAll } from "./access";
import { MAX_TASK_ASSIGNEES } from "./properties";
import { priority, status } from "./schema";

const relationship = v.union(v.literal("created"), v.literal("assigned"), v.literal("subscribed"));
function contribution(task: Doc<"tasks">, subjectId: Id<"users">, selected: Infer<typeof relationship>) {
  // Stored subscriptions survive Trash for restoration; deleted tasks do not count.
  const key: [boolean, Doc<"tasks">["status"], Doc<"tasks">["priority"], Id<"users">] | [boolean, Id<"users">] =
    selected === "assigned"
      ? [taskIsActive(task), task.status, task.priority, task.createdBy]
      : [selected === "subscribed" ? task.deletedAt === null : taskIsActive(task), task.createdBy];
  return {
    id: task._id,
    key,
    namespace: { workspaceId: task.workspaceId, projectId: task.projectId, subjectId, relationship: selected },
    sumValue: Number(selected === "assigned" && task.completedAt !== null),
  };
}
const aggregate = new DirectAggregate<{
  Key: ReturnType<typeof contribution>["key"];
  Id: ReturnType<typeof contribution>["id"];
  Namespace: ReturnType<typeof contribution>["namespace"];
}>(components.profileAggregate);

/** The canonical task mutation and this index commit together. */
/* eslint-disable no-await-in-loop -- Serial native writes preserve Convex's IO budget under atomic bulk writes. */
export async function syncTaskProfile(ctx: MutationCtx, before: Doc<"tasks"> | null, current: Doc<"tasks">) {
  if (
    current.assigneeIds.length > MAX_TASK_ASSIGNEES ||
    new Set(current.assigneeIds).size !== current.assigneeIds.length
  )
    throw new ConvexError(`Task profile indexing requires at most ${MAX_TASK_ASSIGNEES} distinct assignees.`);
  const previous = before ?? current;
  const previousCreator = contribution(previous, previous.createdBy, "created");
  const currentCreator = contribution(current, current.createdBy, "created");
  const creatorChanged = !before || compareValues(previousCreator, currentCreator) !== 0;
  const keyChanged =
    !before ||
    compareValues(
      contribution(previous, previous.createdBy, "assigned"),
      contribution(current, current.createdBy, "assigned")
    ) !== 0;
  const subscriptionChanged =
    !before ||
    compareValues(
      contribution(previous, previous.createdBy, "subscribed"),
      contribution(current, current.createdBy, "subscribed")
    ) !== 0;
  const previousAssignees = new Set(before?.assigneeIds);
  const currentAssignees = new Set(current.assigneeIds);
  const subscriptions = subscriptionChanged
    ? await ctx.db
        .query("taskSubscriptions")
        .withIndex("by_task_user", (q) => q.eq("taskId", current._id))
        .take(MAX_TASK_SUBSCRIBERS + 1)
    : [];
  if (
    subscriptions.length > MAX_TASK_SUBSCRIBERS ||
    new Set(subscriptions.map((item) => item.userId)).size !== subscriptions.length
  )
    throw new ConvexError(
      `Task profile indexing requires at most ${MAX_TASK_SUBSCRIBERS} distinct subscribers. No partial index was written.`
    );
  if (creatorChanged) await aggregate.replaceOrInsert(ctx, previousCreator, currentCreator);
  for (const userId of new Set([...previousAssignees, ...currentAssignees])) {
    if (!currentAssignees.has(userId)) {
      await aggregate.deleteIfExists(ctx, contribution(previous, userId, "assigned"));
      continue;
    }
    if (!keyChanged && previousAssignees.has(userId)) continue;
    await aggregate.replaceOrInsert(
      ctx,
      contribution(previous, userId, "assigned"),
      contribution(current, userId, "assigned")
    );
  }
  for (const subscription of subscriptions)
    await aggregate.replaceOrInsert(
      ctx,
      contribution(previous, subscription.userId, "subscribed"),
      contribution(current, subscription.userId, "subscribed")
    );
}
/* eslint-enable no-await-in-loop */

export async function syncSubscriptionProfile(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  userId: Id<"users">,
  subscribed: boolean
) {
  const entry = contribution(task, userId, "subscribed");
  if (subscribed) await aggregate.insertIfDoesNotExist(ctx, entry);
  else await aggregate.deleteIfExists(ctx, entry);
}

const migration = makeMigration(internalMutation, { migrationTable: "taskProfileMigrations", defaultBatchSize: 1 });
// Each task owns up to 201 distinct contributions. Read current task and
// subscriptions in the same mutation; no audit events or queued index writes.
export const backfill = migration({
  table: "tasks",
  migrateOne: async (ctx, task) => {
    await syncTaskProfile(ctx, null, task);
  },
});

async function projectCounts(
  ctx: QueryCtx,
  project: Doc<"projects">,
  subjectId: Id<"users">,
  viewerId: Id<"users">,
  canReadAll: boolean
) {
  const assigned = {
    workspaceId: project.workspaceId,
    projectId: project._id,
    subjectId,
    relationship: "assigned",
  } satisfies ReturnType<typeof contribution>["namespace"];
  const created = { ...assigned, relationship: "created" } satisfies ReturnType<typeof contribution>["namespace"];
  const subscribed = { ...assigned, relationship: "subscribed" } satisfies ReturnType<typeof contribution>["namespace"];
  const cells = status.members.flatMap((state) =>
    priority.members.map((level) => ({ status: state.value, priority: level.value }))
  );
  const queries: Parameters<typeof aggregate.countBatch>[1] = cells.map((cell) => ({
    namespace: assigned,
    bounds: { prefix: canReadAll ? [true, cell.status, cell.priority] : [true, cell.status, cell.priority, viewerId] },
  }));
  const [counts, completedByTimestamp, createdCount, subscribedCount] = await Promise.all([
    aggregate.countBatch(ctx, queries),
    canReadAll
      ? aggregate.sum(ctx, { namespace: assigned, bounds: { prefix: [true] } })
      : aggregate.sumBatch(ctx, queries).then((values) => values.reduce((sum, value) => sum + value, 0)),
    aggregate.count(ctx, {
      namespace: created,
      bounds: { prefix: canReadAll ? [true] : [true, viewerId] },
    }),
    aggregate.count(ctx, {
      namespace: subscribed,
      bounds: { prefix: canReadAll ? [true] : [true, viewerId] },
    }),
  ]);
  const statusDistribution = status.members.map((state) => ({
    status: state.value,
    count: counts.reduce((sum, count, index) => sum + (cells[index].status === state.value ? count : 0), 0),
  }));
  const priorityDistribution = priority.members.map((level) => ({
    priority: level.value,
    count: counts.reduce((sum, count, index) => sum + (cells[index].priority === level.value ? count : 0), 0),
  }));
  return {
    createdCount,
    assignedCount: counts.reduce((sum, count) => sum + count, 0),
    subscribedCount,
    completedByTimestamp,
    completedCount: statusDistribution
      .filter((item) => item.status === "done")
      .reduce((sum, item) => sum + item.count, 0),
    pendingCount: statusDistribution
      .filter((item) => item.status !== "done" && item.status !== "cancelled")
      .reduce((sum, item) => sum + item.count, 0),
    statusDistribution,
    priorityDistribution,
  };
}

const subjectArgs = { workspaceId: v.id("workspaces"), userId: v.string() };
async function requireSubject(ctx: QueryCtx, workspaceId: Id<"workspaces">, rawUserId: string) {
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

const MAX_PROFILE_PROJECTS_PER_PAGE = 10;
/** Exact project contributions; global totals require exhausting the cursor. */
export const summary = query({
  args: { ...subjectArgs, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { access, target } = await requireSubject(ctx, args.workspaceId, args.userId);
    const readiness = await ctx.db
      .query("taskProfileMigrations")
      .withIndex("name", (q) => q.eq("name", getFunctionName(internal.tasks.profile.backfill)))
      .unique();
    if (!readiness?.isDone)
      throw new ConvexError("Member profile totals are unavailable until the native task index backfill finishes.");
    const options = pageBudget(args.paginationOpts);
    if (options.numItems > MAX_PROFILE_PROJECTS_PER_PAGE)
      throw new ConvexError(`Request at most ${MAX_PROFILE_PROJECTS_PER_PAGE} profile projects per page.`);
    const result = await ctx.db
      .query("projectMembers")
      .withIndex("by_workspace_user_active", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("userId", access.user._id).eq("active", true)
      )
      .paginate({ ...options, maximumRowsRead: MAX_PROFILE_PROJECTS_PER_PAGE });
    const page = await Promise.all(
      result.page.map(async (member) => {
        const project = await ctx.db.get(member.projectId);
        if (!project || project.workspaceId !== args.workspaceId || project.archived || project.deletedAt != null)
          return null;
        const counts = await projectCounts(
          ctx,
          project,
          target._id,
          access.user._id,
          taskRoleCanReadAll(access.member.role, member.role, !!project.guestViewAllFeatures)
        );
        return {
          projectId: project._id,
          name: project.name,
          identifier: project.identifier,
          logo: renderedProjectLogo(project.logoProps ?? {}),
          ...counts,
        };
      })
    );
    return {
      ...result,
      page: page.filter((project) => project !== null),
      coverage: "page" as const,
    };
  },
});
