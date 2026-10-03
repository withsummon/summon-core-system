import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { query, internalMutation, internalQuery } from "../_generated/server";
import schema from "../schema";
import { internal } from "../_generated/api";
import { requireProject, requireWorkspace, requireUser } from "../identity/access";
import { authorizedContext } from "../assistant/context";
import { contextFields } from "../assistant/schema";
import { text, pageBudget } from "../commercial/validation";
import { renderedArtifact, automationInput, generationError } from "./schema";
import { descriptor, requireAsset } from "../assets/access";
import { generationSources } from "../assistant/attachments";
import { summaryAccessForUser } from "../meetings/summary/access";
import { documentGenerationReady } from "../meetings/summary/transcripts";
import { canReadJob, requireJob } from "./access";
export const runFields = {
  templateId: v.id("automationTemplates"),
  expectedTemplateRevision: v.number(),
  projectId: v.id("projects"),
  requestId: v.string(),
  title: v.string(),
  input: automationInput,
  sourceConversationId: v.optional(v.id("assistantConversations")),
  sourceAttachmentIds: v.optional(v.array(v.id("assistantAttachments"))),
  context: v.object(contextFields),
};
export const begin = internalMutation({
  args: runFields,
  handler: async (ctx, args) => {
    const { user, project } = await requireProject(ctx, args.projectId, true);
    const template = await ctx.db.get(args.templateId);
    if (!template || template.deleted || !template.isActive || template.workspaceId !== project.workspaceId)
      throw new ConvexError("Choose an active template in this workspace.");
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(args.requestId) || JSON.stringify(args.input).length > 32000)
      throw new ConvexError("Invalid request identifier or input size.");
    if (args.context.projectId && args.context.projectId !== project._id)
      throw new ConvexError("Context project must match the destination project.");
    const title = text(args.title, "Document title", 255, true);
    const selection = { ...args.context, projectId: project._id };
    const attachmentIds = args.sourceAttachmentIds ?? [];
    if (!args.sourceConversationId && attachmentIds.length) throw new ConvexError("Choose a source conversation.");
    const attachments = args.sourceConversationId
      ? await generationSources(ctx, args.sourceConversationId, project.workspaceId, attachmentIds)
      : [];
    if (
      selection.meetingId &&
      !(await documentGenerationReady(
        ctx,
        await summaryAccessForUser(ctx, project.workspaceId, selection.meetingId, user)
      ))
    )
      throw new ConvexError("Choose a meeting with a ready transcript before generating a document.");
    const context = await authorizedContext(ctx, project.workspaceId, selection, attachments);
    const previous = await ctx.db
      .query("automationJobs")
      .withIndex("by_request", (q) => q.eq("requesterId", user._id).eq("requestId", args.requestId))
      .unique();
    if (previous) {
      if (
        JSON.stringify([
          previous.templateId,
          previous.projectId,
          previous.title,
          previous.sourceConversationId,
          previous.sourceAttachmentIds ?? [],
          previous.input,
          previous.context,
        ]) !==
        JSON.stringify([
          args.templateId,
          args.projectId,
          title,
          args.sourceConversationId,
          attachmentIds,
          args.input,
          selection,
        ])
      )
        throw new ConvexError("Request identifier was used for different generation inputs.");
      return { jobId: previous._id, generate: false, context: "", instructions: "" };
    }
    const { expectedTemplateRevision, ...jobArgs } = args;
    if (expectedTemplateRevision !== template.revision)
      throw new ConvexError("Template changed. Reopen it before generating a preview.");
    const { name, type, description, contentTemplate, variables, isActive } = template;
    const jobId = await ctx.db.insert("automationJobs", {
      ...jobArgs,
      title,
      context: selection,
      workspaceId: project.workspaceId,
      requesterId: user._id,
      template: { name, type, description, contentTemplate, variables, isActive },
      citations: context.citations,
      contextTruncated: context.truncated,
      status: "running",
      previewMarkdown: "",
      provider: "",
      model: "",
      error: null,
      completedAt: null,
      publishedDocumentId: null,
      publishedAt: null,
    });
    await ctx.scheduler.runAfter(240000, internal.automation.jobs.expire, { jobId });
    return { jobId, generate: true, context: context.text, instructions: contentTemplate };
  },
});
export const complete = internalMutation({
  args: { jobId: v.id("automationJobs"), markdown: v.string(), provider: v.string(), model: v.string() },
  handler: async (ctx, args) => {
    const { job } = await requireJob(ctx, args.jobId, true);
    if (job.status !== "running") throw new ConvexError("This job is no longer running.");
    const markdown = args.markdown.trim();
    if (!markdown || markdown.length > 100000)
      throw new ConvexError("Provider returned an empty or oversized preview.");
    await ctx.db.patch(job._id, {
      status: "completed",
      previewMarkdown: markdown,
      provider: args.provider,
      model: args.model,
      completedAt: Date.now(),
    });
  },
});
export const fail = internalMutation({
  args: {
    jobId: v.id("automationJobs"),
    error: generationError,
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const job = await ctx.db.get(args.jobId);
    if (!job || job.requesterId !== user._id) throw new ConvexError("Generation job not found.");
    if (job.status === "running")
      await ctx.db.patch(job._id, { status: "failed", error: args.error, completedAt: Date.now() });
  },
});
export const get = query({
  args: { jobId: v.id("automationJobs") },
  handler: async (ctx, args) => (await requireJob(ctx, args.jobId)).job,
});
export const resolve = query({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    const jobId = ctx.db.normalizeId("automationJobs", args.jobId);
    if (!jobId) throw new ConvexError("Generation job not found.");
    return (await requireJob(ctx, jobId)).job;
  },
});
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    return stream(ctx.db, schema)
      .query("automationJobs")
      .withIndex("by_workspace_requester", (q) => q.eq("workspaceId", args.workspaceId).eq("requesterId", user._id))
      .order("desc")
      .filterWith((job) => canReadJob(ctx, job, user._id))
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const sourceFile = query({
  args: { jobId: v.id("automationJobs"), attachmentId: v.string() },
  handler: async (ctx, args) => {
    const { job } = await requireJob(ctx, args.jobId);
    const attachmentId = ctx.db.normalizeId("assistantAttachments", args.attachmentId);
    if (!attachmentId || !job.sourceAttachmentIds?.includes(attachmentId))
      throw new ConvexError("Document source is unavailable.");
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment) throw new ConvexError("Document source is unavailable.");
    return descriptor((await requireAsset(ctx, attachment.assetId)).asset);
  },
});
export const publication = internalQuery({
  args: { jobId: v.id("automationJobs") },
  handler: async (ctx, args) => {
    const { job } = await requireJob(ctx, args.jobId, true);
    if (job.status !== "completed" || !job.previewMarkdown)
      throw new ConvexError("Only a completed preview can be published.");
    return job;
  },
});

export const rendered = internalMutation({
  args: {
    jobId: v.id("automationJobs"),
    artifacts: v.array(renderedArtifact),
  },
  handler: async (ctx, args) => {
    const { job } = await requireJob(ctx, args.jobId, true);
    if (job.status !== "completed") throw new ConvexError("Only completed previews can be rendered.");
    if (job.artifacts?.length) return false;
    const artifacts = await Promise.all(
      args.artifacts.map(async (file) => {
        const metadata = await ctx.db.system.get(file.storageId);
        if (!metadata || metadata.size > 10000000) throw new ConvexError("Rendered file is unavailable or too large.");
        const assetId = await ctx.db.insert("assets", {
          name: file.name,
          contentType: file.contentType,
          size: metadata.size,
          sha256: metadata.sha256,
          storageId: file.storageId,
          automationJobId: job._id,
          workspaceId: job.workspaceId,
          projectId: job.projectId,
          documentId: null,
          createdBy: job.requesterId,
          status: "ready",
          expiresAt: Date.now() + 7 * 86400000,
        });
        return { assetId, format: file.format };
      })
    );
    await ctx.db.patch(job._id, { artifacts });
    return true;
  },
});
export const artifactLinks = query({
  args: { jobId: v.id("automationJobs") },
  handler: async (ctx, args) => {
    const { job } = await requireJob(ctx, args.jobId);
    return Promise.all(
      (job.artifacts ?? []).map(async (artifact) =>
        Object.assign(descriptor((await requireAsset(ctx, artifact.assetId)).asset), { format: artifact.format })
      )
    );
  },
});

export const discardRendered = internalMutation({
  args: { jobId: v.id("automationJobs"), storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    const assets = await Promise.all((job?.artifacts ?? []).map((artifact) => ctx.db.get(artifact.assetId)));
    const adopted = new Set(assets.map((asset) => asset?.storageId));
    await Promise.all(
      args.storageIds.filter((storageId) => !adopted.has(storageId)).map((storageId) => ctx.storage.delete(storageId))
    );
  },
});

export const expire = internalMutation({
  args: { jobId: v.id("automationJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (job?.status === "running")
      await ctx.db.patch(job._id, { status: "failed", error: "generation_failed", completedAt: Date.now() });
  },
});
