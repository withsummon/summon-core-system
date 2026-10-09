import { allocateAssetApiId } from "../assets/schema";
import { v, ConvexError, compareValues, type Infer } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { query, mutation, internalMutation, internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import { internal } from "../_generated/api";
import { requireProject, requireWorkspace, requireUser } from "../identity/access";
import { authorizedContext } from "../assistant/context";
import { contextFields } from "../assistant/schema";
import { text, pageBudget } from "../commercial/validation";
import { renderedArtifact, automationInput, generationError, generationPreferences, jobStatus } from "./schema";
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
  preferences: v.optional(generationPreferences),
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
      if (previous.deletedAt !== undefined)
        throw new ConvexError("This generation request was retired. Start a new request.");
      if (
        compareValues(
          {
            templateId: previous.templateId,
            projectId: previous.projectId,
            title: previous.title,
            sourceConversationId: previous.sourceConversationId,
            sourceAttachmentIds: previous.sourceAttachmentIds ?? [],
            input: previous.input,
            preferences: previous.preferences,
            context: previous.context,
          },
          {
            templateId: args.templateId,
            projectId: args.projectId,
            title,
            sourceConversationId: args.sourceConversationId,
            sourceAttachmentIds: attachmentIds,
            input: args.input,
            preferences: args.preferences,
            context: selection,
          }
        ) !== 0
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
const searchFields = {
  search: v.optional(v.string()),
  searchScope: v.optional(v.literal("studio")),
};

function requesterJobs(ctx: QueryCtx, workspaceId: Id<"workspaces">, requesterId: Id<"users">) {
  return stream(ctx.db, schema)
    .query("automationJobs")
    .withIndex("by_workspace_requester", (q) => q.eq("workspaceId", workspaceId).eq("requesterId", requesterId))
    .order("desc");
}

async function matchesSearch(
  ctx: QueryCtx,
  job: Doc<"automationJobs">,
  search: string,
  scope: Infer<typeof searchFields.searchScope>
) {
  if (!search) return true;
  const values =
    scope === "studio"
      ? [job.title, job.template.type, (await ctx.db.get(job.projectId))?.name ?? ""]
      : [job.title, job.template.name, ...Object.values(job.input)];
  return values.some((value) => value.toLowerCase().includes(search));
}

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    type: v.optional(v.string()),
    status: v.optional(v.union(...jobStatus.members, v.literal("published"))),
    ...searchFields,
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    if (args.projectId) {
      const { project } = await requireProject(ctx, args.projectId);
      if (project.workspaceId !== args.workspaceId) throw new ConvexError("Project belongs to another workspace.");
    }
    const search = text(args.search ?? "", "Search", 255).toLowerCase();
    return requesterJobs(ctx, args.workspaceId, user._id)
      .filterWith(
        async (job) =>
          (!args.projectId || job.projectId === args.projectId) &&
          (!args.type || job.template.type === args.type) &&
          (!args.status ||
            (args.status === "published" ? job.publishedDocumentId !== null : job.status === args.status)) &&
          (await canReadJob(ctx, job, user._id)) &&
          (await matchesSearch(ctx, job, search, args.searchScope))
      )
      .paginate(pageBudget(args.paginationOpts));
  },
});

export const counts = query({
  args: { workspaceId: v.id("workspaces"), ...searchFields, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    const search = text(args.search ?? "", "Search", 255).toLowerCase();
    return requesterJobs(ctx, args.workspaceId, user._id)
      .filterWith((job) => canReadJob(ctx, job, user._id))
      .map(async (job) => ({
        type: job.template.type,
        matchesSearch: await matchesSearch(ctx, job, search, args.searchScope),
      }))
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const retire = mutation({
  args: {
    jobId: v.id("automationJobs"),
    expectedCompletedAt: v.union(v.number(), v.null()),
    expectedPublishedAt: v.union(v.number(), v.null()),
    expectedArtifactIds: v.array(v.id("assets")),
  },
  handler: async (ctx, args) => {
    const { job } = await requireJob(ctx, args.jobId, true);
    if (job.status === "running") throw new ConvexError("Wait for generation to finish before deleting this preview.");
    if (
      compareValues(
        [job.completedAt, job.publishedAt, (job.artifacts ?? []).map((artifact) => artifact.assetId)],
        [args.expectedCompletedAt, args.expectedPublishedAt, args.expectedArtifactIds]
      ) !== 0
    )
      throw new ConvexError("Preview changed. Reopen before deleting.");
    await ctx.db.patch(job._id, { deletedAt: Date.now() });
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
    const artifacts: NonNullable<typeof job.artifacts> = [];
    // Each allocation sees earlier inserts in this transaction.
    /* oxlint-disable no-await-in-loop */
    for (const file of args.artifacts) {
      const metadata = await ctx.db.system.get(file.storageId);
      if (!metadata || metadata.size > 10000000) throw new ConvexError("Rendered file is unavailable or too large.");
      const assetId = await ctx.db.insert("assets", {
        apiId: await allocateAssetApiId(ctx),
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
      artifacts.push({ assetId, format: file.format });
    }
    /* oxlint-enable no-await-in-loop */
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
