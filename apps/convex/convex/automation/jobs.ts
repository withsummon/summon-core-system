import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { query, internalMutation, internalQuery } from "../_generated/server";
import schema from "../schema";
import { requireProject, requireWorkspace, requireUser } from "../identity/access";
import { authorizedContext } from "../assistant/context";
import { contextFields } from "../assistant/schema";
import { text, pageBudget } from "../commercial/validation";
import { canReadJob, requireJob } from "./access";
export const runFields = {
  templateId: v.id("automationTemplates"),
  expectedTemplateRevision: v.number(),
  projectId: v.id("projects"),
  requestId: v.string(),
  title: v.string(),
  input: v.record(v.string(), v.any()),
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
    const context = await authorizedContext(ctx, project.workspaceId, selection);
    const previous = await ctx.db
      .query("automationJobs")
      .withIndex("by_request", (q) => q.eq("requesterId", user._id).eq("requestId", args.requestId))
      .unique();
    if (previous) {
      if (
        previous.templateId !== args.templateId ||
        previous.projectId !== args.projectId ||
        previous.title !== title ||
        JSON.stringify(previous.input) !== JSON.stringify(args.input) ||
        JSON.stringify(previous.context) !== JSON.stringify(selection)
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
    error: v.union(v.literal("provider_unconfigured"), v.literal("generation_failed")),
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
export const publication = internalQuery({
  args: { jobId: v.id("automationJobs") },
  handler: async (ctx, args) => {
    const { job } = await requireJob(ctx, args.jobId, true);
    if (job.status !== "completed" || !job.previewMarkdown)
      throw new ConvexError("Only a completed preview can be published.");
    return job;
  },
});
