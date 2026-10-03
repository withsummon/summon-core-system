"use node";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { convertGeneratedText } from "../lib/documentConversion";
export const document = action({
  args: { jobId: v.id("automationJobs") },
  handler: async (ctx, args): Promise<Id<"documents">> => {
    const job = await ctx.runQuery(internal.automation.jobs.publication, args);
    return ctx.runMutation(internal.automation.publication.commit, {
      jobId: job._id,
      expectedPreview: job.previewMarkdown,
      ...convertGeneratedText(job.previewMarkdown, job.title),
    });
  },
});
