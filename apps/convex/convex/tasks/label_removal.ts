import { taskChanged } from "./revision";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { pageBudget } from "../commercial/validation";
import { mutation, query } from "../_generated/server";
import { requireLabelManagement } from "./label_access";
import type { Id } from "../_generated/dataModel";
export const list = query({
  args: { projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireLabelManagement(ctx, args.projectId);
    return ctx.db
      .query("labelRemovalJobs")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const begin = mutation({
  args: { labelId: v.id("taskLabels"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const label = await ctx.db.get(args.labelId);
    if (!label) throw new ConvexError("Label not found.");
    await requireLabelManagement(ctx, label.projectId);
    if (label.revision !== args.expectedRevision) throw new ConvexError("Label changed. Reopen its latest settings.");
    if (label.retiring) throw new ConvexError("Label removal is already in progress.");
    const projectLabels = await ctx.db
      .query("taskLabels")
      .withIndex("by_project_order", (q) => q.eq("projectId", label.projectId))
      .take(1001);
    if (projectLabels.length > 1000) throw new ConvexError("Label removal supports up to 1000 project labels.");
    const ids = new Set<Id<"taskLabels">>([label._id]);
    for (let pass = 0; pass < projectLabels.length; pass++) {
      const before = ids.size;
      for (const row of projectLabels) if (row.parentId && ids.has(row.parentId)) ids.add(row._id);
      if (ids.size === before) break;
    }
    const rows = projectLabels.filter((row) => ids.has(row._id));
    if (rows.some((row) => row.retiring)) throw new ConvexError("A child label is already being removed.");
    await Promise.all(rows.map((row) => ctx.db.patch(row._id, { retiring: true, revision: row.revision + 1 })));
    return ctx.db.insert("labelRemovalJobs", {
      workspaceId: label.workspaceId,
      projectId: label.projectId,
      labelIds: [...ids],
      name: label.name,
      phase: "tasks",
      documentLabelIndex: 0,
      cursor: null,
      changed: 0,
      started: false,
      status: "running",
    });
  },
});
export const cancel = mutation({
  args: { jobId: v.id("labelRemovalJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new ConvexError("Removal not found.");
    await requireLabelManagement(ctx, job.projectId);
    if (job.status !== "running") return;
    if (job.started) throw new ConvexError("Removal has already changed references. Continue it to completion.");
    await Promise.all(
      job.labelIds.map(async (id) => {
        const row = await ctx.db.get(id);
        if (row) await ctx.db.patch(id, { retiring: false, revision: row.revision + 1 });
      })
    );
    await ctx.db.patch(job._id, { status: "cancelled" });
  },
});
export const step = mutation({
  args: { jobId: v.id("labelRemovalJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new ConvexError("Removal not found.");
    const { user } = await requireLabelManagement(ctx, job.projectId);
    if (job.status !== "running") return { done: true, changed: 0 };
    const ids = new Set(job.labelIds);
    let changed = 0;
    let cursor: string | null = null;
    let done = false;
    const opts = { cursor: job.cursor, numItems: job.phase === "tasks" ? 20 : 50 };
    if (job.phase === "tasks") {
      const page = await ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", job.projectId))
        .paginate(opts);
      await Promise.all(
        page.page.map(async (row) => {
          const labelIds = row.labelIds.filter((id) => !ids.has(id));
          if (labelIds.length !== row.labelIds.length) {
            await ctx.db.patch(row._id, { labelIds });
            await taskChanged(ctx, row, user._id);
            changed++;
          }
        })
      );
      cursor = page.continueCursor;
      done = page.isDone;
    } else if (job.phase === "drafts") {
      const page = await ctx.db
        .query("taskDrafts")
        .withIndex("by_project", (q) => q.eq("projectId", job.projectId))
        .paginate(opts);
      await Promise.all(
        page.page.map(async (row) => {
          const labelIds = row.properties.labelIds.filter((id) => !ids.has(id));
          if (!row.publishedTaskId && labelIds.length !== row.properties.labelIds.length) {
            await ctx.db.patch(row._id, {
              properties: { ...row.properties, labelIds },
              updatedAt: Math.max(Date.now(), row.updatedAt + 1),
              contentRevision: row.contentRevision + 1,
            });
            changed++;
          }
        })
      );
      cursor = page.continueCursor;
      done = page.isDone;
    } else if (job.phase === "documents") {
      const page = await ctx.db
        .query("documentLabels")
        .withIndex("by_label", (q) => q.eq("labelId", job.labelIds[job.documentLabelIndex]))
        .paginate(opts);
      await Promise.all(
        page.page.map(async (row) => {
          if (ids.has(row.labelId)) {
            await ctx.db.delete(row._id);
            const document = await ctx.db.get(row.documentId);
            if (document)
              await ctx.db.patch(document._id, {
                updatedAt: Math.max(Date.now(), document.updatedAt + 1),
                updatedBy: user._id,
              });
            changed++;
          }
        })
      );
      cursor = page.continueCursor;
      done = page.isDone;
    } else {
      const page = await ctx.db
        .query("savedViews")
        .withIndex("by_workspace_project_deleted", (q) => q.eq("workspaceId", job.workspaceId))
        .paginate(opts);
      await Promise.all(
        page.page.map(async (row) => {
          const labelIds = row.filters.labelIds.filter((id) => !ids.has(id));
          if (labelIds.length !== row.filters.labelIds.length) {
            await ctx.db.patch(row._id, {
              filters: { ...row.filters, labelIds },
              updatedAt: Math.max(Date.now(), row.updatedAt + 1),
            });
            changed++;
          }
        })
      );
      cursor = page.continueCursor;
      done = page.isDone;
    }
    if (done && job.phase === "documents" && job.documentLabelIndex + 1 < job.labelIds.length) {
      await ctx.db.patch(job._id, {
        documentLabelIndex: job.documentLabelIndex + 1,
        cursor: null,
        started: true,
        changed: job.changed + changed,
      });
      return { done: false, changed };
    }
    const next = { tasks: "drafts", drafts: "documents", documents: "views", views: "views" } as const;
    if (done && job.phase === "views") {
      await Promise.all(job.labelIds.map((id) => ctx.db.delete(id)));
      await ctx.db.patch(job._id, { status: "completed", started: true, changed: job.changed + changed, cursor: null });
      return { done: true, changed };
    }
    await ctx.db.patch(job._id, {
      phase: done ? next[job.phase] : job.phase,
      cursor: done ? null : cursor,
      started: true,
      changed: job.changed + changed,
    });
    return { done: false, changed };
  },
});
