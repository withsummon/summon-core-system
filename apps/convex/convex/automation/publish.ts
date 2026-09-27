"use node";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { convertHTMLDocumentToAllFormats, convertBase64StringToBinaryData } from "@plane/editor/lib";
export const document = action({
  args: { jobId: v.id("automationJobs") },
  handler: async (ctx, args): Promise<Id<"documents">> => {
    const job = await ctx.runQuery(internal.automation.jobs.publication, args);
    // Preserve legacy verbatim Markdown publication while deriving all editor formats from one owner.
    const html =
      "<pre>" + job.previewMarkdown.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") + "</pre>";
    const formats = convertHTMLDocumentToAllFormats({ document_html: html, variant: "document" });
    const binary = convertBase64StringToBinaryData(formats.description_binary);
    return ctx.runMutation(internal.automation.publication.commit, {
      jobId: job._id,
      expectedPreview: job.previewMarkdown,
      descriptionBinary: new Uint8Array(binary).buffer,
      descriptionHtml: formats.description_html,
      descriptionJson: formats.description_json,
    });
  },
});
