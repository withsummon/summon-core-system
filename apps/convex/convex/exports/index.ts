import { allocateAssetApiId } from "../assets/schema";
import { compareValues, ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireWorkspace, requireWorkspaceForUser } from "../identity/access";
import { requireAccountUser } from "../identity/session";
import { profileIdentity } from "../identity/profile_owner";
import { personalImageDescriptor, userAppearance } from "../identity/avatar_owner";
import { pageBudget } from "../commercial/validation";
import { descriptor } from "../assets/access";
import { intakeCapabilities } from "../intakes/access";
import { exportProjectReader, requireExportForUser } from "./access";
import { exportFailure, exportFormat, exportFormatLabels, exportLifetime, exportRequestId } from "./schema";
import { exportRecord } from "./records";
import schema from "../schema";

async function projects(ctx: QueryCtx, access: Awaited<ReturnType<typeof requireWorkspaceForUser>>) {
  const memberships = await ctx.db
    .query("projectMembers")
    .withIndex("by_workspace_user_active", (q) =>
      q.eq("workspaceId", access.workspace._id).eq("userId", access.user._id).eq("active", true)
    )
    .collect();
  const read = exportProjectReader(ctx, access);
  return (await Promise.all(memberships.map(({ projectId }) => read(projectId)))).filter((project) => project !== null);
}
export const settings = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId);
    return {
      canExport: access.member.role !== "guest",
      formats: exportFormat.members.map(({ value }) => ({ value, label: exportFormatLabels[value] })),
      projects:
        access.member.role === "guest"
          ? []
          : (await projects(ctx, access)).map(({ _id, name, identifier }) => ({ id: _id, name, identifier })),
    };
  },
});
export const start = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    requestId: v.string(),
    format: exportFormat,
    projectIds: v.array(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId, true);
    const requestId = exportRequestId.parse(args.requestId);
    if (new Set(args.projectIds).size !== args.projectIds.length) throw new ConvexError("Choose distinct projects.");
    // oxlint-disable-next-line unicorn/no-array-sort -- Sort a cloned request array; generated consumers use the web's ES2020 lib.
    const requestedProjectIds = [...args.projectIds].sort();
    const previous = await ctx.db
      .query("workspaceExports")
      .withIndex("by_requester_request", (q) => q.eq("requesterId", access.user._id).eq("requestId", requestId))
      .unique();
    if (previous) {
      if (
        previous.workspaceId !== args.workspaceId ||
        previous.format !== args.format ||
        compareValues(previous.requestedProjectIds, requestedProjectIds) !== 0
      )
        throw new ConvexError("This export request already belongs to another selection.");
      await requireExportForUser(ctx, previous, access.user);
      return previous._id;
    }
    const read = exportProjectReader(ctx, access);
    const selected = requestedProjectIds.length
      ? await Promise.all(requestedProjectIds.map(read))
      : await projects(ctx, access);
    if (!selected.length || selected.some((project) => project === null))
      throw new ConvexError("Choose projects you can fully read.");
    const projectIds = selected.filter((project) => project !== null).map(({ _id }) => _id);
    const expiresAt = Date.now() + exportLifetime;
    const jobId = await ctx.db.insert("workspaceExports", {
      workspaceId: access.workspace._id,
      requesterId: access.user._id,
      requestId,
      format: args.format,
      requestedProjectIds,
      projectIds,
      sourceProjectIds: [],
      perProject: requestedProjectIds.length > 1,
      status: "queued",
      failure: null,
      deadline: Date.now() + 240000,
      expiresAt,
      assetId: null,
    });
    await ctx.scheduler.runAfter(0, internal.exports.worker.run, { jobId });
    await ctx.scheduler.runAfter(240000, internal.exports.index.fail, { jobId, failure: "deadline_exceeded" });
    await ctx.scheduler.runAt(expiresAt, internal.exports.index.expire, { jobId });
    return jobId;
  },
});
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId);
    const paginationOpts = pageBudget(args.paginationOpts);
    if (access.member.role === "guest") return { page: [], isDone: true, continueCursor: "" };
    const read = exportProjectReader(ctx, access);
    return stream(ctx.db, schema)
      .query("workspaceExports")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .map(async (job) => {
        const canRead = (await Promise.all([...new Set([...job.projectIds, ...job.sourceProjectIds])].map(read))).every(
          Boolean
        );
        const asset =
          canRead && job.status === "completed" && job.expiresAt > Date.now() && job.assetId
            ? await ctx.db.get(job.assetId)
            : null;
        return {
          id: job._id,
          createdAt: job._creationTime,
          expiresAt: job.expiresAt,
          requesterName: (await profileIdentity(ctx, job.requesterId))?.displayName ?? "",
          requesterAvatar: await personalImageDescriptor(
            ctx,
            await userAppearance(ctx, job.requesterId),
            "avatar",
            args.workspaceId
          ),
          projectCount: job.projectIds.length,
          format: job.format,
          formatLabel: exportFormatLabels[job.format],
          status: job.status,
          failure: job.failure,
          artifact: asset?.status === "ready" ? descriptor(asset) : null,
        };
      })
      .paginate(paginationOpts);
  },
});
async function processing(ctx: QueryCtx, jobId: Id<"workspaceExports">) {
  const job = await ctx.db.get(jobId);
  if (!job || job.status !== "processing" || job.deadline <= Date.now())
    throw new ConvexError("Export is no longer processing.");
  return requireExportForUser(ctx, job, await requireAccountUser(ctx, job.requesterId));
}
export const claim = internalMutation({
  args: { jobId: v.id("workspaceExports") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "queued" || job.deadline <= Date.now()) return null;
    const { workspace } = await requireExportForUser(ctx, job, await requireAccountUser(ctx, job.requesterId));
    await ctx.db.patch(jobId, { status: "processing" });
    return { ...job, workspaceSlug: workspace.slug };
  },
});
export const records = internalQuery({
  args: { jobId: v.id("workspaceExports"), projectId: v.id("projects"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await processing(ctx, args.jobId);
    if (!access.job.projectIds.includes(args.projectId)) throw new ConvexError("Project is outside this export.");
    const read = exportProjectReader(ctx, access);
    return stream(ctx.db, schema)
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .map(async (task) => {
        if (task.workspaceId !== access.workspace._id || task.deletedAt !== null) return null;
        if (task.status === "triage") {
          const intake = await ctx.db
            .query("intakeTasks")
            .withIndex("by_task", (q) => q.eq("taskId", task._id))
            .unique();
          const project = await read(args.projectId);
          const projectMember = await ctx.db
            .query("projectMembers")
            .withIndex("by_project_user", (q) => q.eq("projectId", args.projectId).eq("userId", access.user._id))
            .unique();
          if (
            !intake ||
            intake.deletedAt !== null ||
            !project ||
            !projectMember ||
            !intakeCapabilities({ ...access, project, projectMember }, intake.createdBy).canRead
          )
            return null;
        }
        return exportRecord(ctx, task, access, read);
      })
      .paginate(pageBudget(args.paginationOpts, 20));
  },
});
export const complete = internalMutation({
  args: {
    jobId: v.id("workspaceExports"),
    storageId: v.id("_storage"),
    name: v.string(),
    sourceProjectIds: v.array(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const access = await processing(ctx, args.jobId);
    await requireExportForUser(ctx, { ...access.job, sourceProjectIds: args.sourceProjectIds }, access.user);
    const bytes = await ctx.db.system.get(args.storageId);
    if (!bytes || bytes._creationTime < access.job._creationTime || bytes.size > 10 * 1024 * 1024)
      throw new ConvexError("Export file is invalid.");
    const previous = await ctx.db
      .query("assets")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (previous) throw new ConvexError("Export file is already claimed.");
    const assetId = await ctx.db.insert("assets", {
      apiId: await allocateAssetApiId(ctx),
      workspaceId: access.job.workspaceId,
      projectId: null,
      documentId: null,
      exportJobId: access.job._id,
      name: args.name,
      contentType: "application/zip",
      size: bytes.size,
      sha256: bytes.sha256,
      createdBy: access.job.requesterId,
      storageId: args.storageId,
      status: "ready",
      expiresAt: access.job.expiresAt,
    });
    await ctx.db.patch(args.jobId, {
      status: "completed",
      sourceProjectIds: [...new Set(args.sourceProjectIds)],
      assetId,
    });
  },
});
export const fail = internalMutation({
  args: { jobId: v.id("workspaceExports"), failure: exportFailure },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (job && (job.status === "queued" || job.status === "processing"))
      await ctx.db.patch(job._id, { status: "failed", failure: args.failure });
  },
});
export const expire = internalMutation({
  args: { jobId: v.id("workspaceExports") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.expiresAt > Date.now() || job.status === "expired") return;
    if (job.assetId) {
      const asset = await ctx.db.get(job.assetId);
      if (asset?.exportJobId === jobId) {
        if (asset.storageId) await ctx.storage.delete(asset.storageId);
        await ctx.db.patch(asset._id, { status: "expired", storageId: null });
      }
    }
    await ctx.db.patch(job._id, { status: "expired" });
  },
});
