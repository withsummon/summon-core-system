import { allocateAssetApiId } from "../../assets/schema";
import { requireUsableLabel } from "../label_access";
import { validateEstimatePoint } from "../../estimates/access";
import { liveDraftAssets } from "../../assets/draft_access";
import { compareValues, ConvexError, v, type Infer } from "convex/values";
import { action, internalQuery, internalMutation } from "../../_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { requireDraft, draftRevision } from "./access";
import { attachmentRevision } from "../../assets/task_access";
import { boundDescriptionContent, remapDescriptionImages } from "../description_images";
import { requireTask } from "../access";
import { requireTaskRevision } from "../revision";
import { requireDescriptionVersion } from "../description_content";
import { requireProject, requireUser } from "../../identity/access";
import { taskEditSource } from "../index";
import { copyRequestId, taskCopyFields } from "./schema";

const copiedFiles = v.array(v.object({ sourceId: v.id("assets"), revision: v.number(), storageId: v.id("_storage") }));
const taskCopy = v.object(taskCopyFields);
function copyBudget(assets: Doc<"assets">[]) {
  if (assets.length > 100 || assets.reduce((sum, asset) => sum + asset.size, 0) > 32 * 1024 * 1024)
    throw new ConvexError("Copy supports at most 100 files and 32 MiB of ready bytes.");
}
async function source(ctx: QueryCtx, draftId: Id<"taskDrafts">, expectedUpdatedAt: number) {
  const { draft } = await requireDraft(ctx, draftId);
  draftRevision(draft.updatedAt, expectedUpdatedAt);
  if (draft.deletedAt !== null || draft.publishedTaskId) throw new ConvexError("Only an active draft can be copied.");
  if (draft.projectId) await validateEstimatePoint(ctx, draft.projectId, draft.properties.estimatePointId);
  const assets = await liveDraftAssets(ctx, draftId);
  if (assets.length > 100) throw new ConvexError("Draft attachment limit exceeded.");
  if (assets.some((asset) => asset.status === "pending" && asset.expiresAt > Date.now()))
    throw new ConvexError("Finish or cancel pending uploads before copying.");
  const ready = assets.filter((asset) => asset.status === "ready");
  if (ready.some((asset) => asset.createdBy !== draft.authorId))
    throw new ConvexError("Draft attachment uploader mismatch.");
  copyBudget(ready);
  const content = await boundDescriptionContent(ctx, { draftId }, draft.html);
  return { draft, assets: ready, content };
}
export const snapshot = internalQuery({
  args: { draftId: v.id("taskDrafts"), expectedUpdatedAt: v.number() },
  handler: (ctx, args) => source(ctx, args.draftId, args.expectedUpdatedAt),
});

/** Storage ownership and the source receipt are rechecked in the destination transaction. */
async function copyAssets(
  ctx: MutationCtx,
  draft: Pick<Doc<"taskDrafts">, "_id" | "workspaceId" | "authorId">,
  assets: Doc<"assets">[],
  files: Infer<typeof copiedFiles>
) {
  const bySource = new Map(files.map((file) => [file.sourceId, file]));
  if (
    files.length !== assets.length ||
    bySource.size !== assets.length ||
    new Set(files.map((file) => file.storageId)).size !== files.length
  )
    throw new ConvexError("Description files changed during copy.");
  const mapped = new Map<Id<"assets">, Id<"assets">>();
  // Each allocation sees earlier inserts in this transaction.
  /* oxlint-disable no-await-in-loop */
  for (const asset of assets) {
    const file = bySource.get(asset._id);
    if (!file || attachmentRevision(asset) !== file.revision)
      throw new ConvexError("Description files changed during copy.");
    const blob = await ctx.db.system.get(file.storageId);
    const claimed = await ctx.db
      .query("assets")
      .withIndex("by_storage", (q) => q.eq("storageId", file.storageId))
      .unique();
    if (!blob || claimed || blob.size !== asset.size || blob.sha256 !== asset.sha256)
      throw new ConvexError("Copied bytes do not match the source.");
    const targetId = await ctx.db.insert("assets", {
      apiId: await allocateAssetApiId(ctx),
      draftId: draft._id,
      workspaceId: draft.workspaceId,
      projectId: null,
      documentId: null,
      createdBy: draft.authorId,
      name: asset.name,
      contentType: asset.contentType,
      size: asset.size,
      sha256: asset.sha256,
      storageId: file.storageId,
      status: "ready",
      expiresAt: asset.expiresAt,
      attachmentRevision: 0,
    });
    mapped.set(asset._id, targetId);
  }
  /* oxlint-enable no-await-in-loop */
  return mapped;
}

export const commit = internalMutation({
  args: { draftId: v.id("taskDrafts"), expectedUpdatedAt: v.number(), files: copiedFiles },
  handler: async (ctx, args) => {
    const { draft, assets, content } = await source(ctx, args.draftId, args.expectedUpdatedAt);
    await Promise.all(draft.properties.labelIds.map((id) => requireUsableLabel(ctx, id)));
    const { _id, _creationTime, copySource, ...fields } = draft;
    const draftId = await ctx.db.insert("taskDrafts", { ...fields, contentRevision: 0, updatedAt: Date.now() });
    const sources = await copyAssets(ctx, { ...draft, _id: draftId }, assets, args.files);
    const rewritten = remapDescriptionImages(content.html, sources);
    const changed = rewritten.html !== draft.html;
    await ctx.db.patch(draftId, {
      ...rewritten,
      descriptionJson: changed ? null : draft.descriptionJson,
      descriptionBinary: changed ? null : draft.descriptionBinary,
    });
    return draftId;
  },
});

/** Sequential bytes keep both draft copy entry points within the existing action memory budget. */
async function copyBytes(ctx: ActionCtx, assets: Doc<"assets">[]): Promise<Infer<typeof copiedFiles>> {
  const files: Infer<typeof copiedFiles> = [];
  for (const asset of assets) {
    if (!asset.storageId) throw new ConvexError("Source attachment bytes are missing.");
    // oxlint-disable-next-line no-await-in-loop
    const blob = await ctx.storage.get(asset.storageId);
    if (!blob) throw new ConvexError("Source attachment bytes are missing.");
    // Failed copies remain unclaimed for the existing storage orphan sweep.
    // oxlint-disable-next-line no-await-in-loop
    const storageId = await ctx.storage.store(blob);
    files.push({ sourceId: asset._id, revision: attachmentRevision(asset), storageId });
  }
  return files;
}
export const run = action({
  args: { draftId: v.id("taskDrafts"), expectedUpdatedAt: v.number() },
  handler: async (ctx, args): Promise<Id<"taskDrafts">> => {
    const sourceSnapshot = await ctx.runQuery(internal.tasks.drafts.copy.snapshot, args);
    const files = await copyBytes(ctx, sourceSnapshot.assets);
    return ctx.runMutation(internal.tasks.drafts.copy.commit, { ...args, files });
  },
});

async function taskSource(ctx: QueryCtx, args: Infer<typeof taskCopy>) {
  const parsed = copyRequestId.safeParse(args.requestId);
  if (!parsed.success) throw new ConvexError("Provide a UUID for this copy request.");
  const user = await requireUser(ctx);
  const existing = await ctx.db
    .query("taskDrafts")
    .withIndex("by_author_copy_request", (q) => q.eq("authorId", user._id).eq("copySource.requestId", parsed.data))
    .unique();
  if (existing?.copySource) {
    const { projectId, ...receipt } = existing.copySource;
    if (compareValues(receipt, args) !== 0)
      throw new ConvexError("This copy request belongs to another source receipt.");
    await requireDraft(ctx, existing._id);
    return { draftId: existing._id, source: null };
  }
  const task = await requireTask(ctx, args.taskId);
  await requireProject(ctx, task.projectId, true);
  requireTaskRevision(task, args.expectedUpdatedAt);
  await requireDescriptionVersion(ctx, task._id, args.expectedContentVersion);
  const edit = await taskEditSource(ctx, task);
  if (edit.hasParent && !edit.parent)
    throw new ConvexError("Resolve the unavailable parent before copying this work item.");
  const content = await boundDescriptionContent(ctx, task._id, edit.html);
  copyBudget(content.assets);
  return {
    draftId: null,
    source: {
      task,
      authorId: user._id,
      content,
      edit,
    },
  };
}
export const taskSnapshot = internalQuery({ args: taskCopyFields, handler: taskSource });
export const taskCommit = internalMutation({
  args: { ...taskCopyFields, files: copiedFiles },
  handler: async (ctx, { files, ...args }) => {
    const prepared = await taskSource(ctx, args);
    if (prepared.draftId !== null) return prepared.draftId;
    const { source: current } = prepared;
    const { task, content, edit } = current;
    const draftId = await ctx.db.insert("taskDrafts", {
      workspaceId: task.workspaceId,
      authorId: current.authorId,
      projectId: task.projectId,
      title: `${task.title} (copy)`,
      html: content.html,
      description: content.description,
      status: task.status,
      properties: edit.properties,
      parent: edit.parent,
      cycle: edit.cycle,
      modules: edit.modules,
      descriptionJson: edit.descriptionJson,
      descriptionBinary: edit.descriptionBinary,
      updatedAt: Date.now(),
      contentRevision: 0,
      deletedAt: null,
      publishedTaskId: null,
      copySource: { ...args, projectId: task.projectId },
    });
    const sources = await copyAssets(
      ctx,
      { _id: draftId, workspaceId: task.workspaceId, authorId: current.authorId },
      content.assets,
      files
    );
    const rewritten = remapDescriptionImages(content.html, sources);
    const changed = rewritten.html !== edit.html;
    await ctx.db.patch(draftId, {
      ...rewritten,
      descriptionJson: changed ? null : edit.descriptionJson,
      descriptionBinary: changed ? null : edit.descriptionBinary,
    });
    return draftId;
  },
});
export const fromTask = action({
  args: taskCopyFields,
  handler: async (ctx, args): Promise<Id<"taskDrafts">> => {
    const prepared = await ctx.runQuery(internal.tasks.drafts.copy.taskSnapshot, args);
    if (prepared.draftId !== null) return prepared.draftId;
    const files = await copyBytes(ctx, prepared.source.content.assets);
    return ctx.runMutation(internal.tasks.drafts.copy.taskCommit, { ...args, files });
  },
});
