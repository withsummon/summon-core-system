import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { pageBudget } from "../commercial/validation";
import schema from "../schema";
import { v, ConvexError } from "convex/values";
import { action as defineAction, mutation, query, internalMutation } from "../_generated/server";
import { status } from "../tasks/schema";
import { requireTask, taskCanRead } from "../tasks/access";
import { requireProject } from "../identity/access";
import { changeTaskStatus } from "../tasks/status";
import { requireConversation } from "./access";
import { ensureDefaultTemplates } from "../automation/templates";
import { generationSources } from "./attachments";
import { api, internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
export const propose = mutation({
  args: {
    conversationId: v.id("assistantConversations"),
    taskId: v.id("tasks"),
    nextStatus: status,
  },
  handler: async (ctx, args) => {
    const { conversation, user } = await requireConversation(ctx, args.conversationId, true);
    const task = await requireTask(ctx, args.taskId);
    await requireProject(ctx, task.projectId, true);
    if (
      task.workspaceId !== conversation.workspaceId ||
      (conversation.context.projectId && conversation.context.projectId !== task.projectId)
    )
      throw new ConvexError("Task is outside the conversation context.");
    return ctx.db.insert("assistantActions", {
      ...args,
      workspaceId: conversation.workspaceId,
      requesterId: user._id,
      operation: "set_task_status",
      taskTitle: task.title,
      previousStatus: task.status,
      expectedUpdatedAt: task.updatedAt,
      status: "pending",
      confirmedAt: null,
    });
  },
});
export const get = query({
  args: { actionId: v.id("assistantActions") },
  handler: async (ctx, { actionId }) => {
    const action = await ctx.db.get(actionId);
    if (!action) throw new ConvexError("Action not found.");
    await requireConversation(ctx, action.conversationId);
    if (action.operation === "generate_document") return action;
    const task = await requireTask(ctx, action.taskId, "read");
    await requireProject(ctx, task.projectId);
    return action;
  },
});
export const confirm = mutation({
  args: { actionId: v.id("assistantActions") },
  handler: async (ctx, { actionId }) => {
    const action = await ctx.db.get(actionId);
    if (!action) throw new ConvexError("Action not found.");
    const { conversation } = await requireConversation(ctx, action.conversationId, true);
    if (action.operation !== "set_task_status") throw new ConvexError("Confirm documents through document generation.");
    const task = await requireTask(ctx, action.taskId);
    await requireProject(ctx, task.projectId, true);
    if (
      task.workspaceId !== conversation.workspaceId ||
      (conversation.context.projectId && conversation.context.projectId !== task.projectId)
    )
      throw new ConvexError("Task is outside the conversation context.");
    if (action.status === "completed") return;
    if (action.status !== "pending") throw new ConvexError("Action is no longer pending.");
    if (task.updatedAt !== action.expectedUpdatedAt)
      throw new ConvexError("Task changed. Request a new preview before confirming.");
    await changeTaskStatus(ctx, { taskId: task._id, status: action.nextStatus });
    await ctx.db.patch(actionId, { status: "completed", confirmedAt: Date.now() });
  },
});
export const cancel = mutation({
  args: { actionId: v.id("assistantActions") },
  handler: async (ctx, { actionId }) => {
    const action = await ctx.db.get(actionId);
    if (!action) throw new ConvexError("Action not found.");
    await requireConversation(ctx, action.conversationId, true);
    if (action.status === "running") throw new ConvexError("Document generation is already running.");
    if (["pending", "failed"].includes(action.status)) await ctx.db.patch(actionId, { status: "cancelled" });
  },
});

export const list = query({
  args: { conversationId: v.id("assistantConversations"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireConversation(ctx, args.conversationId);
    return stream(ctx.db, schema)
      .query("assistantActions")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .map(async (action) => {
        if (action.operation === "generate_document") return action;
        const task = await ctx.db.get(action.taskId);
        if (!task || !(await taskCanRead(ctx, task, user._id))) return null;
        return action;
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
function matchedTemplate(content: string, templates: Doc<"automationTemplates">[], aliases = true) {
  const normalized = normalize(content);
  const exact = templates.find((item) => [normalize(item.name), normalize(item.type)].includes(normalized));
  if (exact) return exact;
  const mentioned = templates.find((item) =>
    [normalize(item.name), normalize(item.type)].some((name) => ` ${normalized} `.includes(` ${name} `))
  );
  if (mentioned) return mentioned;
  if (aliases && (normalized.split(" ").includes("mom") || normalized.includes("minutes of meeting")))
    return templates.find((item) => item.type === (normalized.includes("iglo") ? "mom_iglo" : "mom_summon"));
  return undefined;
}
export async function documentProposal(
  ctx: MutationCtx,
  conversation: Doc<"assistantConversations">,
  content: string,
  sourceIds: Id<"assistantAttachments">[]
) {
  await ensureDefaultTemplates(ctx, conversation.workspaceId);
  const templates = (
    await ctx.db
      .query("automationTemplates")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", conversation.workspaceId).eq("deleted", false))
      .take(101)
  ).filter((item) => item.isActive);
  if (templates.length > 100) throw new ConvexError("Too many active document templates.");
  const pending = (
    await ctx.db
      .query("assistantActions")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
      .order("desc")
      .take(100)
  ).find((item) => item.operation === "generate_document" && item.status === "pending" && !item.templateId);
  const selected = matchedTemplate(content, templates, false);
  if (pending?.operation === "generate_document" && selected) {
    await ctx.db.patch(pending._id, {
      templateId: selected._id,
      templateRevision: selected.revision,
      attachmentIds: sourceIds,
    });
    return `Confirm generation of ${selected.name}.`;
  }
  const template = matchedTemplate(content, templates);
  const words = new Set(normalize(content).split(" "));
  const requested =
    ["buat", "buatkan", "create", "generate", "hasilkan", "susun"].some((word) => words.has(word)) &&
    [
      "bast",
      "document",
      "dokumen",
      "file",
      "invoice",
      "laporan",
      "mom",
      "presentation",
      "presentasi",
      "proposal",
      "quotation",
      "timeline",
      "uat",
    ].some((word) => words.has(word));
  if (!template && !requested) return null;
  await ctx.db.insert("assistantActions", {
    workspaceId: conversation.workspaceId,
    conversationId: conversation._id,
    requesterId: conversation.ownerId,
    operation: "generate_document",
    request: content,
    templateId: template?._id ?? null,
    templateRevision: template?.revision ?? null,
    projectId: conversation.context.projectId,
    attachmentIds: sourceIds,
    jobId: null,
    generationAttempt: 0,
    status: "pending",
    confirmedAt: null,
    error: null,
  });
  return template ? `Confirm generation of ${template.name}.` : "Choose the document type to generate.";
}
export const selectDocument = mutation({
  args: { actionId: v.id("assistantActions"), templateId: v.id("automationTemplates"), projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const action = await ctx.db.get(args.actionId);
    if (
      !action ||
      action.operation !== "generate_document" ||
      !["pending", "failed"].includes(action.status) ||
      action.confirmedAt
    )
      throw new ConvexError("Document proposal is no longer editable.");
    const { conversation } = await requireConversation(ctx, action.conversationId, true);
    const { project } = await requireProject(ctx, args.projectId, true);
    const template = await ctx.db.get(args.templateId);
    if (
      project.workspaceId !== conversation.workspaceId ||
      !template ||
      template.deleted ||
      !template.isActive ||
      template.workspaceId !== conversation.workspaceId
    )
      throw new ConvexError("Choose an active template and project in this workspace.");
    await ctx.db.patch(action._id, {
      templateId: template._id,
      templateRevision: template.revision,
      projectId: project._id,
    });
  },
});
export const prepareDocument = internalMutation({
  args: { actionId: v.id("assistantActions"), expectedAttempt: v.number() },
  handler: async (ctx, args) => {
    const action = await ctx.db.get(args.actionId);
    if (
      !action ||
      action.operation !== "generate_document" ||
      !["pending", "failed", "completed"].includes(action.status) ||
      action.generationAttempt !== args.expectedAttempt ||
      !action.templateId ||
      !action.projectId ||
      action.templateRevision === null
    )
      throw new ConvexError("Document proposal changed or is already running.");
    const { conversation } = await requireConversation(ctx, action.conversationId, true);
    await requireProject(ctx, action.projectId, true);
    await generationSources(ctx, conversation._id, conversation.workspaceId, action.attachmentIds);
    const job = action.jobId ? await ctx.db.get(action.jobId) : null;
    const generationAttempt = action.generationAttempt + (job?.status === "failed" ? 1 : 0);
    await ctx.db.patch(action._id, { status: "running", error: null, confirmedAt: Date.now(), generationAttempt });
    await ctx.scheduler.runAfter(240000, internal.assistant.actions.documentFailed, {
      actionId: action._id,
      expectedAttempt: generationAttempt,
      render: false,
    });
    if (job?.status === "completed") return { jobId: job._id, input: null, generationAttempt };
    const template = await ctx.db.get(action.templateId);
    if (
      !template ||
      template.deleted ||
      !template.isActive ||
      template.workspaceId !== conversation.workspaceId ||
      template.revision !== action.templateRevision
    )
      throw new ConvexError("Template changed. Select it again before confirming.");
    return {
      jobId: null,
      generationAttempt,
      input: {
        templateId: template._id,
        expectedTemplateRevision: template.revision,
        projectId: action.projectId,
        requestId: `document_${action._id}_${generationAttempt}`,
        title: template.name,
        input: { brief: action.request },
        context: { ...conversation.context, projectId: action.projectId },
        sourceConversationId: conversation._id,
        sourceAttachmentIds: action.attachmentIds,
      },
    };
  },
});
export const documentJob = internalMutation({
  args: { actionId: v.id("assistantActions"), jobId: v.id("automationJobs") },
  handler: async (ctx, args) => {
    const action = await ctx.db.get(args.actionId);
    const job = await ctx.db.get(args.jobId);
    if (
      !action ||
      action.operation !== "generate_document" ||
      action.status !== "running" ||
      !job ||
      job.requestId !== `document_${action._id}_${action.generationAttempt}` ||
      job.sourceConversationId !== action.conversationId ||
      job.requesterId !== action.requesterId
    )
      throw new ConvexError("Document result is unavailable.");
    await requireConversation(ctx, action.conversationId, true);
    await ctx.db.patch(action._id, { jobId: job._id });
  },
});
export const documentResult = internalMutation({
  args: { actionId: v.id("assistantActions") },
  handler: async (ctx, args) => {
    const action = await ctx.db.get(args.actionId);
    if (!action || action.operation !== "generate_document" || action.status !== "running" || !action.jobId)
      throw new ConvexError("Document result is unavailable.");
    const { conversation } = await requireConversation(ctx, action.conversationId, true);
    const job = await ctx.db.get(action.jobId);
    if (!job || job.status !== "completed" || !job.artifacts?.length)
      throw new ConvexError("Rendered document is not ready.");
    await ctx.db.patch(action._id, { status: "completed", error: null });
    const requestId = `document_result_${job._id}`;
    const previous = await ctx.db
      .query("assistantMessages")
      .withIndex("by_request_role", (q) =>
        q.eq("conversationId", conversation._id).eq("requestId", requestId).eq("role", "assistant")
      )
      .unique();
    if (!previous)
      await ctx.db.insert("assistantMessages", {
        workspaceId: job.workspaceId,
        conversationId: conversation._id,
        requestId,
        role: "assistant",
        status: "completed",
        content: `${job.template.name} is ready to preview and download.`,
        citations: job.citations,
        context: job.context,
        contextTruncated: job.contextTruncated,
        provider: job.provider,
        model: job.model,
        inputTokens: null,
        outputTokens: null,
        error: null,
      });
    await ctx.db.patch(conversation._id, { lastActivityAt: Date.now() });
  },
});
export const documentFailed = internalMutation({
  args: { actionId: v.id("assistantActions"), expectedAttempt: v.number(), render: v.boolean() },
  handler: async (ctx, args) => {
    const action = await ctx.db.get(args.actionId);
    if (
      !action ||
      action.operation !== "generate_document" ||
      action.status !== "running" ||
      action.generationAttempt !== args.expectedAttempt
    )
      return;
    const job = await ctx.db
      .query("automationJobs")
      .withIndex("by_request", (q) =>
        q.eq("requesterId", action.requesterId).eq("requestId", `document_${action._id}_${action.generationAttempt}`)
      )
      .unique();
    if (job?.status === "running")
      await ctx.db.patch(job._id, { status: "failed", error: "generation_failed", completedAt: Date.now() });
    await ctx.db.patch(action._id, {
      status: "failed",
      error: args.render ? "document_render_failed" : "document_generation_failed",
      jobId: job?._id ?? action.jobId,
      confirmedAt: args.render || job?.status === "completed" ? action.confirmedAt : null,
    });
  },
});
export const executeDocument = defineAction({
  args: { actionId: v.id("assistantActions"), expectedAttempt: v.number() },
  handler: async (ctx, args): Promise<Id<"automationJobs">> => {
    const prepared = await ctx.runMutation(internal.assistant.actions.prepareDocument, args);
    let rendering = false;
    const expectedAttempt = prepared.generationAttempt;
    try {
      const jobId = prepared.jobId ?? (await ctx.runAction(api.automation.generate.preview, prepared.input));
      if (!prepared.jobId)
        await ctx.runMutation(internal.assistant.actions.documentJob, { actionId: args.actionId, jobId });
      const job = await ctx.runQuery(api.automation.jobs.get, { jobId });
      if (job.status !== "completed")
        throw new ConvexError("Document generation did not complete. Check the generation job before retrying.");
      rendering = true;
      await ctx.runAction(api.automation.generate.render, { jobId });
      await ctx.runMutation(internal.assistant.actions.documentResult, { actionId: args.actionId });
      return jobId;
    } catch (error) {
      await ctx.runMutation(internal.assistant.actions.documentFailed, {
        actionId: args.actionId,
        expectedAttempt,
        render: rendering,
      });
      throw error;
    }
  },
});
