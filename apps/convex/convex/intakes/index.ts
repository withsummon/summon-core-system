import { ensureDefaultIntake } from "./configuration_owner";
import { boundDescriptionContent } from "../tasks/description_images";
import { writeDescription } from "../tasks/description_content";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { projectMetadata } from "../projects/settings";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { createTask } from "../tasks/create";
import { initialProperties, parseTaskText, validateNonStateProperties } from "../tasks/properties";
import { priority, nonStateTaskProperties } from "../tasks/schema";
import { taskRichContent, plainDescriptionHtml } from "../tasks/rich_content";
import { taskChanged } from "../tasks/revision";
import { requireTask } from "../tasks/access";
import { intakeCapabilities, requireIntakeTask, requireIntakeRevision } from "./access";
import { intakeStatus } from "./schema";
const { priority: _priority, ...intakePropertyFields } = nonStateTaskProperties;
const intakeProperties = v.object(intakePropertyFields);
const version = { taskId: v.id("tasks"), expectedUpdatedAt: v.number(), expectedTaskUpdatedAt: v.number() };
export const getConfig = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const access = await requireProject(ctx, projectId);
    const intake = await ctx.db
      .query("intakes")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .unique();
    return {
      intake,
      enabled: access.project.intakeEnabled ?? false,
      guestViewAllFeatures: access.project.guestViewAllFeatures ?? false,
      revision: projectMetadata(access.project).revision,
      canConfigure: intakeCapabilities(access, access.user._id).canDecide,
      canEditProperties: intakeCapabilities(access, access.user._id).canEditProperties,
    };
  },
});
export const configure = mutation({
  args: {
    projectId: v.id("projects"),
    expectedRevision: v.number(),
    enabled: v.boolean(),
    guestViewAllFeatures: v.boolean(),
  },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    if (!intakeCapabilities(access, access.user._id).canDecide)
      throw new ConvexError("Only administrators can configure intake.");
    if (projectMetadata(access.project).revision !== args.expectedRevision)
      throw new ConvexError("Project settings changed. Refresh before saving.");
    if (args.enabled) await ensureDefaultIntake(ctx, access.project);
    await ctx.db.patch(args.projectId, {
      intakeEnabled: args.enabled,
      guestViewAllFeatures: args.guestViewAllFeatures,
      metadataRevision: args.expectedRevision + 1,
    });
  },
});
export const submit = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    html: v.string(),
    priority,
    properties: v.optional(intakeProperties),
  },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    const { project, user } = access;
    const intake = await ctx.db
      .query("intakes")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .unique();
    if (!project.intakeEnabled || !intake) throw new ConvexError("Intake is not enabled for this project.");
    if (args.properties && !intakeCapabilities(access, user._id).canEditProperties)
      throw new ConvexError("Guests can set priority when submitting, but cannot assign intake properties.");
    const properties = await validateNonStateProperties(ctx, project, {
      ...initialProperties,
      ...args.properties,
      priority: args.priority,
    });
    const content = taskRichContent(args.html);
    const { title } = parseTaskText(args.title, content.description);
    let state = await ctx.db
      .query("taskStates")
      .withIndex("by_project_name", (q) => q.eq("projectId", project._id).eq("name", "Triage"))
      .unique();
    if (state && state.status !== "triage")
      throw new ConvexError("Rename the existing Triage state before enabling submissions.");
    const stateId =
      state?._id ??
      (await ctx.db.insert("taskStates", {
        projectId: project._id,
        workspaceId: project.workspaceId,
        name: "Triage",
        description: "",
        color: "#4E5355",
        status: "triage",
        sortOrder: 65000,
        isDefault: false,
      }));
    const taskId = await createTask(
      ctx,
      project,
      user._id,
      {
        ...initialProperties,
        ...properties,
        title,
        description: content.description,
        status: "triage",
        priority: args.priority,
        stateId,
      },
      null,
      content.html
    );
    await ctx.db.insert("intakeTasks", {
      projectId: project._id,
      intakeId: intake._id,
      taskId,
      status: "pending",
      snoozedUntil: null,
      duplicateTo: null,
      source: "IN_APP",
      createdBy: user._id,
      updatedAt: Date.now(),
      deletedAt: null,
      removalTaskRevision: null,
    });
    return taskId;
  },
});
async function detail(ctx: QueryCtx, taskId: Id<"tasks">) {
  const { task, intake, canEdit, canEditPriority, canEditProperties, canDecide, canRemove } = await requireIntakeTask(
    ctx,
    taskId
  );
  const content = await ctx.db
    .query("taskDescriptions")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .unique();
  // Duplicate targets were validated on write. Re-check current visibility before projecting metadata.
  const target = intake.duplicateTo ? await ctx.db.get(intake.duplicateTo) : null;
  const duplicateTarget =
    target && target.projectId === task.projectId && target.deletedAt == null && target.status !== "triage"
      ? { _id: target._id, title: target.title, sequence: target.sequence }
      : null;
  return {
    task,
    intake,
    html: content?.html ?? plainDescriptionHtml(task.description),
    duplicateTarget,
    canEdit,
    canEditPriority,
    canEditProperties,
    canDecide,
    canRemove,
  };
}
export const get = query({ args: { taskId: v.id("tasks") }, handler: async (ctx, args) => detail(ctx, args.taskId) });
export const resolve = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("tasks", args.taskId);
    if (!id) throw new ConvexError("Intake task not found.");
    return detail(ctx, id);
  },
});
export const list = query({
  args: { projectId: v.id("projects"), status: v.optional(intakeStatus), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    const result = await ctx.db
      .query("intakeTasks")
      .withIndex("by_project_status", (q) => q.eq("projectId", args.projectId).eq("status", args.status ?? "pending"))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (intake) => {
        if (intake.deletedAt != null || !intakeCapabilities(access, intake.createdBy).canRead) return null;
        const task = await ctx.db.get(intake.taskId);
        if (!task || task.deletedAt != null || task.archivedAt != null) return null;
        return { intake, task, ...intakeCapabilities(access, intake.createdBy) };
      })
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
});
export const edit = mutation({
  args: {
    ...version,
    title: v.string(),
    html: v.optional(v.string()),
    priority: v.optional(priority),
    properties: v.optional(intakeProperties),
  },
  handler: async (ctx, args) => {
    const { task, intake, access, canEdit } = await requireIntakeTask(ctx, args.taskId);
    if (!canEdit)
      throw new ConvexError("Only a project writer, the creator or an administrator can edit this submission.");
    requireIntakeRevision(intake, task, args.expectedUpdatedAt, args.expectedTaskUpdatedAt);
    const guest = access.member.role === "guest" || access.projectMember.role === "guest";
    if (guest && (args.properties !== undefined || (args.priority !== undefined && args.priority !== task.priority)))
      throw new ConvexError("Guests can edit only the title and description.");
    const properties =
      args.properties || args.priority !== undefined
        ? await validateNonStateProperties(
            ctx,
            access.project,
            { ...task, ...args.properties, priority: args.priority ?? task.priority },
            task.estimatePointId
          )
        : null;
    const content = args.html === undefined ? null : await boundDescriptionContent(ctx, task._id, args.html);
    const { title } = parseTaskText(args.title, content?.description ?? task.description);
    if (content) await writeDescription(ctx, task, access.user._id, content);
    await ctx.db.patch(task._id, { title, ...properties });
    await taskChanged(ctx, task, access.user._id);
    await ctx.db.patch(intake._id, { updatedAt: Math.max(Date.now(), intake.updatedAt + 1) });
  },
});
function validateDecision(args: Pick<Doc<"intakeTasks">, "status" | "snoozedUntil" | "duplicateTo">) {
  if (
    args.snoozedUntil !== null &&
    (!Number.isSafeInteger(args.snoozedUntil) || Math.abs(args.snoozedUntil) > 8640000000000000)
  )
    throw new ConvexError("Enter a valid snooze date.");
  if (args.status === "snoozed" && args.snoozedUntil === null) throw new ConvexError("Choose a snooze date.");
  if (args.status === "duplicate" && args.duplicateTo === null) throw new ConvexError("Choose the duplicate task.");
}
export const decide = mutation({
  args: {
    ...version,
    status: intakeStatus,
    snoozedUntil: v.union(v.number(), v.null()),
    duplicateTo: v.union(v.id("tasks"), v.null()),
  },
  handler: async (ctx, args) => {
    const { task, intake, access, canDecide } = await requireIntakeTask(ctx, args.taskId);
    if (!canDecide) throw new ConvexError("Only administrators can triage submissions.");
    requireIntakeRevision(intake, task, args.expectedUpdatedAt, args.expectedTaskUpdatedAt);
    validateDecision(args);
    if (args.duplicateTo) {
      const target = await requireTask(ctx, args.duplicateTo, "read");
      if (target.projectId !== task.projectId || target._id === task._id)
        throw new ConvexError("Choose another task in this project.");
    }
    if (args.status === "accepted" && task.status === "triage") {
      const state = await ctx.db
        .query("taskStates")
        .withIndex("by_project_default", (q) => q.eq("projectId", task.projectId).eq("isDefault", true))
        .unique();
      if (!state || state.status === "triage")
        throw new ConvexError("Cannot accept: no default state exists for this project.");
      await ctx.db.patch(task._id, {
        stateId: state._id,
        status: state.status,
        completedAt: state.status === "done" ? Date.now() : null,
      });
    }
    await taskChanged(ctx, task, access.user._id);
    await ctx.db.patch(intake._id, {
      status: args.status,
      snoozedUntil: args.snoozedUntil,
      duplicateTo: args.duplicateTo,
      updatedAt: Math.max(Date.now(), intake.updatedAt + 1),
    });
  },
});
export const remove = mutation({
  args: version,
  handler: async (ctx, args) => {
    const { task, intake, access, canRemove } = await requireIntakeTask(ctx, args.taskId);
    if (!canRemove) throw new ConvexError("Only the creator or an administrator can remove this submission.");
    requireIntakeRevision(intake, task, args.expectedUpdatedAt, args.expectedTaskUpdatedAt);
    const deletedAt = Date.now();
    const deletesTask = intake.status !== "accepted";
    if (deletesTask) await ctx.db.patch(task._id, { deletedAt });
    const taskRevision = await taskChanged(ctx, task, access.user._id);
    await ctx.db.patch(intake._id, {
      deletedAt,
      updatedAt: Math.max(Date.now(), intake.updatedAt + 1),
      removalTaskRevision: deletesTask ? taskRevision : null,
    });
  },
});
