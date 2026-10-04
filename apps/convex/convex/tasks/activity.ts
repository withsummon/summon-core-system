import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, type PaginationOptions } from "convex/server";
import { stream, type QueryStream } from "convex-helpers/server/stream";
import type { Doc } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { date, pageBudget } from "../commercial/validation";
import { cycleDay } from "../cycles/dates";
import { personalImageDescriptor, userAppearance } from "../identity/avatar_owner";
import { defaultProfile } from "../identity/profile_owner";
import { intakeCapabilities } from "../intakes/access";
import { projectReader } from "../savedViews/scope";
import schema from "../schema";
import { requireTask, taskRoleCanRead } from "./access";
import { requireSubject } from "./profile";

// Existing mutation events are the activity owner; this query never reconstructs history.
export const list = query({
  args: { taskId: v.id("tasks"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const task = await requireTask(ctx, args.taskId, "read");
    const result = await ctx.db
      .query("taskEvents")
      .withIndex("by_task", (q) => q.eq("taskId", task._id))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (event) => {
        const actor = await ctx.db.get(event.actorId);
        return {
          id: event._id,
          at: event._creationTime,
          kind: event.kind,
          status: event.status,
          changes: event.changes ?? null,
          automation: event.automation === true,
          actorName: actor?.name ?? null,
        };
      })
    );
    return { ...result, page };
  },
});

// Both the feed and export apply current access before native cursor pagination.
async function profilePage(
  ctx: QueryCtx,
  subject: Awaited<ReturnType<typeof requireSubject>>,
  source: QueryStream<Doc<"taskEvents">>,
  paginationOpts: PaginationOptions
) {
  const { access, target } = subject;
  const readProject = projectReader(ctx, access.workspace._id, access.user._id);
  const avatar = await personalImageDescriptor(
    ctx,
    await userAppearance(ctx, target._id),
    "avatar",
    access.workspace._id
  );
  return source
    .map(async (event) => {
      if (["reaction_changed", "vote_changed"].includes(event.kind) || event.kind.startsWith("comment_")) return null;
      const task = await ctx.db.get(event.taskId);
      if (!task || task.workspaceId !== event.workspaceId || task.projectId !== event.projectId) return null;
      const scope = await readProject(task.projectId);
      if (!scope) return null;
      if (task.status === "triage") {
        const intake = await ctx.db
          .query("intakeTasks")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .unique();
        if (!intake || intake.projectId !== task.projectId) return null;
        const capabilities = intakeCapabilities(
          { ...access, projectMember: scope.member, project: scope.project },
          intake.createdBy
        );
        if (
          intake.deletedAt !== null
            ? !capabilities.canRemove
            : !capabilities.canRead || task.deletedAt !== null || task.archivedAt !== null
        )
          return null;
      } else if (task.deletedAt !== null) {
        if (task.createdBy !== access.user._id && scope.member.role !== "admin") return null;
      } else if (
        !taskRoleCanRead(
          task,
          access.user._id,
          access.member.role,
          scope.member.role,
          !!scope.project.guestViewAllFeatures
        )
      )
        return null;
      return {
        id: event._id,
        at: event._creationTime,
        kind: event.kind,
        status: event.status,
        changes: event.changes ?? null,
        automation: event.automation === true,
        actorId: target._id,
        actorName: target.name ?? null,
        avatar,
        workspaceSlug: access.workspace.slug,
        projectId: scope.project._id,
        projectName: scope.project.name,
        projectIdentifier: scope.project.identifier,
        taskId: task._id,
        taskTitle: task.title,
        sequence: task.sequence,
        archivedAt: task.archivedAt,
        deletedAt: task.deletedAt,
        taskStatus: task.status,
      };
    })
    .paginate(pageBudget(paginationOpts));
}

export const profile = query({
  args: { workspaceId: v.id("workspaces"), userId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const subject = await requireSubject(ctx, args.workspaceId, args.userId);
    const source = stream(ctx.db, schema)
      .query("taskEvents")
      .withIndex("by_workspace_actor", (q) => q.eq("workspaceId", args.workspaceId).eq("actorId", subject.target._id))
      .order("desc");
    return profilePage(ctx, subject, source, args.paginationOpts);
  },
});

export const exportDay = query({
  args: {
    workspaceId: v.id("workspaces"),
    userId: v.string(),
    day: v.optional(v.string()),
    timezone: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const subject = await requireSubject(ctx, args.workspaceId, args.userId);
    if (subject.access.member.role === "guest") throw new ConvexError("Only workspace members can export activity.");
    const storedProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", subject.access.user._id))
      .unique();
    const timezone = (storedProfile ?? defaultProfile).timezone;
    if (args.paginationOpts.cursor !== null && (args.day === undefined || args.timezone !== timezone))
      throw new ConvexError("Restart the activity export using its returned date and current timezone.");
    const day = args.day ?? cycleDay(timezone, Date.now());
    date(day);
    const utcDay = Date.parse(day);
    // A local calendar day lies inside this three-day UTC range for IANA offsets.
    // The existing timezone owner handles the exact day, including DST.
    const source = stream(ctx.db, schema)
      .query("taskEvents")
      .withIndex("by_workspace_actor", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("actorId", subject.target._id)
          .gte("_creationTime", utcDay - 86_400_000)
          .lt("_creationTime", utcDay + 2 * 86_400_000)
      )
      .order("desc")
      .filterWith(async (event) => cycleDay(timezone, event._creationTime) === day);
    return { day, timezone, ...(await profilePage(ctx, subject, source, args.paginationOpts)) };
  },
});
