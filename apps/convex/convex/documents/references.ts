import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalMutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireDocument } from "./access";
import { taskCanRead } from "../tasks/access";
import { pageBudget } from "../commercial/validation";
import { documentReferenceTokens } from "./reference_tokens";
export const REFERENCE_BATCH_SIZE = 50;
export async function scheduleDocumentReferences(
  ctx: MutationCtx,
  snapshot: Pick<Doc<"documentRevisions">, "_id" | "documentId" | "revision">
) {
  const existing = await ctx.db
    .query("documentReferenceJobs")
    .withIndex("by_snapshot", (q) => q.eq("snapshotId", snapshot._id))
    .unique();
  if (existing) return { jobId: existing._id, created: false };
  const jobId = await ctx.db.insert("documentReferenceJobs", {
    documentId: snapshot.documentId,
    snapshotId: snapshot._id,
    revision: snapshot.revision,
    cursor: 0,
    status: "pending",
  });
  await ctx.scheduler.runAfter(0, internal.documents.references.step, { jobId });
  return { jobId, created: true };
}
export const step = internalMutation({
  args: { jobId: v.id("documentReferenceJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "pending") return;
    const document = await ctx.db.get(job.documentId);
    if (!document || document.revision !== job.revision) {
      await ctx.db.patch(jobId, { status: "obsolete" });
      await ctx.scheduler.runAfter(0, internal.documents.references.cleanup, { jobId });
      return;
    }
    const snapshot = await ctx.db.get(job.snapshotId);
    if (!snapshot || snapshot.documentId !== job.documentId || snapshot.revision !== job.revision)
      throw new Error("Document reference snapshot provenance is invalid.");
    const tokens = documentReferenceTokens(snapshot.descriptionJson);
    const batch = tokens.slice(job.cursor, job.cursor + REFERENCE_BATCH_SIZE);
    await Promise.all(batch.map((token) => ctx.db.insert("documentReferences", { jobId, ...token })));
    const cursor = job.cursor + batch.length;
    await ctx.db.patch(jobId, { cursor });
    if (cursor < tokens.length) {
      await ctx.scheduler.runAfter(0, internal.documents.references.step, { jobId });
      return;
    }
    const previous = await ctx.db
      .query("documentReferencePublications")
      .withIndex("by_document", (q) => q.eq("documentId", job.documentId))
      .unique();
    if (previous) {
      await ctx.db.patch(previous._id, { revision: job.revision, jobId });
      await ctx.db.patch(previous.jobId, { status: "obsolete" });
      await ctx.scheduler.runAfter(0, internal.documents.references.cleanup, { jobId: previous.jobId });
    } else
      await ctx.db.insert("documentReferencePublications", {
        documentId: job.documentId,
        revision: job.revision,
        jobId,
      });
    await ctx.db.patch(jobId, { status: "published" });
  },
});
export const cleanup = internalMutation({
  args: { jobId: v.id("documentReferenceJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "obsolete") return;
    const published = await ctx.db
      .query("documentReferencePublications")
      .withIndex("by_document", (q) => q.eq("documentId", job.documentId))
      .unique();
    if (published?.jobId === jobId) return;
    const rows = await ctx.db
      .query("documentReferences")
      .withIndex("by_job", (q) => q.eq("jobId", jobId))
      .take(REFERENCE_BATCH_SIZE);
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    if (rows.length === REFERENCE_BATCH_SIZE)
      await ctx.scheduler.runAfter(0, internal.documents.references.cleanup, { jobId });
    else await ctx.db.delete(jobId);
  },
});
export const issues = query({
  args: { documentId: v.id("documents"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { document, user } = await requireDocument(ctx, args.documentId);
    const publication = await ctx.db
      .query("documentReferencePublications")
      .withIndex("by_document", (q) => q.eq("documentId", document._id))
      .unique();
    if (!publication || publication.revision !== document.revision)
      return {
        status: document.revision === 0 ? ("ready" as const) : ("updating" as const),
        revision: document.revision,
        page: [],
        isDone: true,
        continueCursor: "",
      };
    const result = await ctx.db
      .query("documentReferences")
      .withIndex("by_job_entity", (q) => q.eq("jobId", publication.jobId).eq("entityName", "issue"))
      .paginate(pageBudget(args.paginationOpts));
    const rows = await Promise.all(
      result.page.map(async (row) => {
        const id = ctx.db.normalizeId("tasks", row.entityIdentifier);
        const task = id ? await ctx.db.get(id) : null;
        if (!task || task.workspaceId !== document.workspaceId || !(await taskCanRead(ctx, task, user._id)))
          return { transactionId: row.transactionId, task: null };
        const project = await ctx.db.get(task.projectId);
        return {
          transactionId: row.transactionId,
          task: project
            ? {
                id: task._id,
                title: task.title,
                sequence: task.sequence,
                projectId: project._id,
                identifier: project.identifier,
              }
            : null,
        };
      })
    );
    return { ...result, status: "ready" as const, revision: document.revision, page: rows };
  },
});
export const backfill = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("documents").paginate({ cursor, numItems: 20 });
    const scheduled = await Promise.all(
      page.page
        .filter((document) => document.revision > 0)
        .map(async (document) => {
          const snapshot = await ctx.db
            .query("documentRevisions")
            .withIndex("by_document_revision", (q) =>
              q.eq("documentId", document._id).eq("revision", document.revision)
            )
            .unique();
          if (!snapshot) throw new Error("Document reference snapshot is missing.");
          return (await scheduleDocumentReferences(ctx, snapshot)).created;
        })
    );
    return { cursor: page.continueCursor, isDone: page.isDone, scheduled: scheduled.filter(Boolean).length };
  },
});
