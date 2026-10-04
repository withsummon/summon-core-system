import { z } from "zod/v4";
import { ConvexError, v } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { worker } from "../automation/generate";
import { validateContent } from "../assets/content";
import type { exportRecord } from "./records";

const exportedFile = z.strictObject({
  name: z
    .string()
    .min(5)
    .max(255)
    .regex(/^[a-zA-Z0-9_-]+\.zip$/),
  base64: z.string().base64().min(4).max(14000000),
});
export const run = internalAction({
  args: { jobId: v.id("workspaceExports") },
  handler: async (ctx, args) => {
    let storageId: Id<"_storage"> | null = null;
    let adopted = false;
    try {
      const job = await ctx.runMutation(internal.exports.index.claim, args);
      if (!job) return;
      const files: { name: string; records: NonNullable<Awaited<ReturnType<typeof exportRecord>>>["record"][] }[] = [];
      const sourceProjectIds = new Set<Id<"projects">>();
      let bytes = 0;
      for (const projectId of job.projectIds) {
        const file: (typeof files)[number] = job.perProject
          ? { name: `${job.workspaceSlug}-${projectId}`, records: [] }
          : (files[0] ?? { name: `${job.workspaceSlug}-${job.workspaceId}`, records: [] });
        if (!files.includes(file)) files.push(file);
        let cursor: string | null = null;
        while (true) {
          // The durable account owner checks current project authority on every bounded page.
          // oxlint-disable-next-line no-await-in-loop
          const page: FunctionReturnType<typeof internal.exports.index.records> = await ctx.runQuery(
            internal.exports.index.records,
            {
              ...args,
              projectId,
              paginationOpts: { numItems: 20, cursor },
            }
          );
          for (const row of page.page) {
            bytes += new TextEncoder().encode(JSON.stringify(row.record)).byteLength;
            if (bytes > 10 * 1024 * 1024) throw new ConvexError("Export exceeds the document worker request limit.");
            file.records.push(row.record);
            for (const id of row.sourceProjectIds) sourceProjectIds.add(id);
          }
          if (page.isDone) break;
          if (page.continueCursor === cursor) throw new Error("Export cursor did not advance.");
          cursor = page.continueCursor;
        }
      }
      const body = JSON.stringify({
        format: job.format,
        name: `export-${job.workspaceSlug}-${job.requestId.slice(0, 6)}-${new Date(job._creationTime).toISOString().slice(0, 10)}`,
        files,
      });
      if (new TextEncoder().encode(body).byteLength > 10 * 1024 * 1024)
        throw new ConvexError("Export exceeds the document worker request limit.");
      const result = exportedFile.parse(
        await worker("/export", { method: "POST", headers: { "Content-Type": "application/json" }, body })
      );
      const data = Uint8Array.from(atob(result.base64), (character) => character.charCodeAt(0));
      if (data.byteLength > 10 * 1024 * 1024) throw new ConvexError("Export ZIP exceeds 10 MB.");
      const blob = new Blob([data], { type: "application/zip" });
      await validateContent(blob, "application/zip");
      storageId = await ctx.storage.store(blob);
      await ctx.runMutation(internal.exports.index.complete, {
        ...args,
        storageId,
        name: result.name,
        sourceProjectIds: [...sourceProjectIds],
      });
      adopted = true;
    } catch {
      await ctx.runMutation(internal.exports.index.fail, { ...args, failure: "processing_failed" });
    } finally {
      if (storageId && !adopted) await ctx.storage.delete(storageId);
    }
  },
});
