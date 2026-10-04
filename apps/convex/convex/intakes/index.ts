import { ensureDefaultIntake } from "./configuration_owner";
import { boundDescriptionContent } from "../tasks/description_images";
import { writeDescription } from "../tasks/description_content";
import { ConvexError, v, type Infer } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { convexToZod } from "convex-helpers/server/zod4";
import { mutation, query } from "../_generated/server";
import type { DataModel, Doc } from "../_generated/dataModel";
import { projectMetadata } from "../projects/settings";
import { requireProject } from "../identity/access";
import { pageBudget } from "../commercial/validation";
import { checkRange, inRange, matchesFilters, validateShape } from "../savedViews/filters";
import { createTask } from "../tasks/create";
import { initialProperties, parseTaskText, validateNonStateProperties, creationAssignees } from "../tasks/properties";
import { priority, nonStateTaskProperties } from "../tasks/schema";
import { taskRichContent, plainDescriptionHtml } from "../tasks/rich_content";
import { taskChanged } from "../tasks/revision";
import { requireTask, taskCanRead } from "../tasks/access";
import { intakeCapabilities, requireIntakeTask, requireIntakeRevision } from "./access";
import { defaultIntakeSelection, intakeDefaults, intakeSelection, intakeStatus, intakeView } from "./schema";
import schema from "../schema";
const { priority: _priority, ...intakePropertyFields } = nonStateTaskProperties;
const intakeProperties = v.object(intakePropertyFields);
const version = { taskId: v.id("tasks"), expectedUpdatedAt: v.number(), expectedTaskUpdatedAt: v.number() };
export const getConfig = query({
  args: { projectId: v.id("projects"), view: v.optional(intakeView), selectionJson: v.optional(v.string()) },
  handler: async (ctx, { projectId, view, selectionJson }) => {
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
      selection:
        selectionJson === undefined
          ? view
            ? intakeDefaults(view)
            : defaultIntakeSelection
          : convexToZod(intakeSelection).parse(JSON.parse(selectionJson)),
      emptySelection: defaultIntakeSelection,
      priorities: priority.members.map((option) => option.value),
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
      assigneeIds: await creationAssignees(ctx, project, args.properties?.assigneeIds ?? []),
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
export const resolve = query({
  args: { projectId: v.id("projects"), taskId: v.string() },
  handler: async (ctx, args) => {
    const taskId = ctx.db.normalizeId("tasks", args.taskId);
    if (!taskId) throw new ConvexError("Intake task not found.");
    const { task, intake, access, canEdit, canEditPriority, canEditProperties, canDecide, canRemove } =
      await requireIntakeTask(ctx, taskId);
    if (task.projectId !== args.projectId) throw new ConvexError("Intake task not found.");
    const content = await ctx.db
      .query("taskDescriptions")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .unique();
    const target = intake.duplicateTo ? await ctx.db.get(intake.duplicateTo) : null;
    const duplicateTarget =
      target && target.projectId === task.projectId && (await taskCanRead(ctx, target, access.user._id))
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
  },
});
export const list = query({
  args: {
    projectId: v.id("projects"),
    view: intakeView,
    selection: v.optional(intakeSelection),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireProject(ctx, args.projectId);
    const selection = args.selection ?? intakeDefaults(args.view);
    if (new Set(selection.statuses).size !== selection.statuses.length)
      throw new ConvexError("Choose distinct intake statuses.");
    const filters = {
      ...selection,
      match: "all",
      statuses: [],
      stateIds: [],
      startDate: null,
      targetDate: null,
    } satisfies Parameters<typeof validateShape>[0];
    validateShape(filters);
    checkRange(selection.createdAt);
    checkRange(selection.updatedAt);
    const indexes = {
      createdAt: "by_project",
      updatedAt: "by_project_updated",
      sequence: "by_project_sequence",
    } satisfies Record<Infer<typeof intakeSelection>["order"], keyof DataModel["tasks"]["indexes"]>;
    const now = Date.now();
    const { view } = args;
    const rows = stream(ctx.db, schema)
      .query("tasks")
      .withIndex(indexes[selection.order], (q) => q.eq("projectId", args.projectId));
    return rows
      .order(selection.direction)
      .map(async (task) => {
        if (task.deletedAt != null || task.archivedAt != null || task.workspaceId !== access.project.workspaceId)
          return null;
        const intake = await ctx.db
          .query("intakeTasks")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .unique();
        if (!intake || intake.projectId !== args.projectId) return null;
        const effectiveStatus =
          intake.status === "snoozed" && intake.snoozedUntil !== null && intake.snoozedUntil <= now
            ? "pending"
            : intake.status;
        const open = effectiveStatus === "pending" || effectiveStatus === "snoozed";
        if (
          intake.deletedAt != null ||
          !intakeCapabilities(access, intake.createdBy).canRead ||
          (view === "open" && !open) ||
          (view === "closed" && open) ||
          (view !== "open" && view !== "closed" && effectiveStatus !== view)
        )
          return null;
        if (selection.statuses.length && !selection.statuses.includes(effectiveStatus)) return null;
        if (!matchesFilters(task, filters)) return null;
        for (const [value, range] of [
          [task._creationTime, selection.createdAt],
          [task.updatedAt, selection.updatedAt],
        ] as const) {
          if (range && !inRange(new Date(value).toISOString().slice(0, 10), range)) return null;
        }
        return { intake, task };
      })
      .paginate(pageBudget(args.paginationOpts));
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
            task
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
