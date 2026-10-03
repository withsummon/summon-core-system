import { v, ConvexError } from "convex/values";
import { internalMutation } from "../_generated/server";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { snapshotFields } from "../documents/schema";
import { requireDocument } from "../documents/access";
import { saveDocumentSnapshot } from "../documents/index";
import { requireJob } from "./access";
export const commit = internalMutation({
  args: { jobId: v.id("automationJobs"), expectedPreview: v.string(), ...snapshotFields },
  handler: async (ctx, { jobId, expectedPreview, ...snapshot }): Promise<Id<"documents">> => {
    const { job } = await requireJob(ctx, jobId, true);
    if (job.publishedDocumentId) {
      await requireDocument(ctx, job.publishedDocumentId);
      return job.publishedDocumentId;
    }
    if (job.status !== "completed" || job.previewMarkdown !== expectedPreview)
      throw new ConvexError("Generation preview changed or is not complete.");
    const documentId = await ctx.runMutation(api.documents.index.create, {
      workspaceId: job.workspaceId,
      name: job.title,
      access: "public",
      isGlobal: false,
      projectIds: [job.projectId],
      color: "",
      viewProps: {
        full_width: false,
        summon_automation_job_id: job._id,
        summon_document: {
          kind: "summon_automation",
          markdown: job.previewMarkdown,
          provider: job.provider,
          model: job.model,
          citations: job.citations,
        },
      },
      logoProps: {},
      sortOrder: 65535,
      category: job.template.type,
      tags: [],
      clientId: job.context.clientId,
      opportunityId: null,
      externalId: null,
      externalSource: null,
    });
    await saveDocumentSnapshot(ctx, { documentId, expectedRevision: 0, ...snapshot });
    await ctx.db.patch(jobId, { publishedDocumentId: documentId, publishedAt: Date.now() });
    return documentId;
  },
});
