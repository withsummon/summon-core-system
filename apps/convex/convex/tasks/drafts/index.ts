import { transferDraftAttachments } from "../../assets/draftAttachments";
import { preserveDescriptionRepresentations } from "../description_content";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { mutation, query, type QueryCtx, type MutationCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import schema from "../../schema";
import { requireWorkspace, requireProject } from "../../identity/access";
import { pageBudget } from "../../commercial/validation";
import { boundedJson } from "../../../shared/json";
import { initialProperties } from "../properties";
import { boundDescriptionContent } from "../description_images";
import { createPreparedTask } from "../create";
import { requireTask } from "../access";
import { draftFields } from "./fields";
import { requireDraft, draftRevision, draftProjectReadable } from "./access";
import { validateDraft } from "./validate";
import { projectSummary } from "../../savedViews/scope";
async function draftDetail(ctx: QueryCtx, draft: Doc<"taskDrafts">, role: Doc<"workspaceMembers">["role"]) {
  const permission = draft.projectId ? await requireProject(ctx, draft.projectId) : null;
  return {
    ...draft,
    project: permission ? projectSummary(permission.project) : null,
    canPublish:
      draft.deletedAt === null &&
      !draft.publishedTaskId &&
      role !== "guest" &&
      permission !== null &&
      permission.projectMember.role !== "guest",
  };
}
export const create = mutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    const { completedAt, ...properties } = initialProperties;
    return ctx.db.insert("taskDrafts", {
      workspaceId: args.workspaceId,
      authorId: user._id,
      projectId: null,
      title: "",
      html: "<p></p>",
      description: "",
      status: null,
      properties,
      parent: null,
      cycle: null,
      modules: [],
      descriptionJson: null,
      descriptionBinary: null,
      updatedAt: Date.now(),
      contentRevision: 0,
      deletedAt: null,
      publishedTaskId: null,
    });
  },
});
export const list = query({
  args: { workspaceId: v.id("workspaces"), deleted: v.boolean(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user, member } = await requireWorkspace(ctx, args.workspaceId);
    return stream(ctx.db, schema)
      .query("taskDrafts")
      .withIndex("by_author_workspace", (q) => q.eq("authorId", user._id).eq("workspaceId", args.workspaceId))
      .order("desc")
      .filterWith(
        async (row) =>
          !row.publishedTaskId && (row.deletedAt !== null) === args.deleted && draftProjectReadable(ctx, row, user._id)
      )
      .map((draft) => draftDetail(ctx, draft, member.role))
      .paginate(pageBudget(args.paginationOpts));
  },
});
export const resolve = query({
  args: { workspaceId: v.id("workspaces"), draftId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("taskDrafts", args.draftId);
    if (!id) throw new ConvexError("Draft not found.");
    const { draft, member } = await requireDraft(ctx, id);
    if (draft.workspaceId !== args.workspaceId) throw new ConvexError("Draft not found.");
    return draftDetail(ctx, draft, member.role);
  },
});
export const save = mutation({
  args: {
    draftId: v.id("taskDrafts"),
    expectedContentRevision: v.number(),
    ...draftFields,
    descriptionJson: v.optional(v.any()),
    descriptionBinary: v.optional(v.union(v.bytes(), v.null())),
  },
  handler: async (ctx, args) => {
    const { draft } = await requireDraft(ctx, args.draftId);
    if (draft.deletedAt !== null || draft.publishedTaskId)
      throw new ConvexError("Restore an unpublished draft before editing.");
    if (draft.contentRevision !== args.expectedContentRevision)
      throw new ConvexError("Draft content changed. Reopen it before saving.");
    if (draft.copySource && args.projectId !== draft.copySource.projectId)
      throw new ConvexError("A copied work item must stay in its source project.");
    const updatedAt = Math.max(Date.now(), draft.updatedAt + 1);
    await validateDraft(ctx, draft.workspaceId, args);
    const content = await boundDescriptionContent(ctx, { draftId: draft._id }, args.html);
    const htmlChanged = content.html !== draft.html;
    const json =
      args.descriptionJson === undefined
        ? htmlChanged
          ? null
          : draft.descriptionJson
        : boundedJson(args.descriptionJson, "Description JSON", 100000);
    const binary =
      args.descriptionBinary === undefined ? (htmlChanged ? null : draft.descriptionBinary) : args.descriptionBinary;
    if (binary && binary.byteLength > 524288) throw new ConvexError("Description binary must be at most 512 KiB.");
    const { draftId, expectedContentRevision, descriptionJson, descriptionBinary, ...fields } = args;
    await ctx.db.patch(draftId, {
      ...fields,
      html: content.html,
      description: content.description,
      descriptionJson: json,
      descriptionBinary: binary,
      contentRevision: draft.contentRevision + 1,
      updatedAt,
    });
    return { updatedAt, contentRevision: draft.contentRevision + 1 };
  },
});
export async function changeDraftDeleted(
  ctx: MutationCtx,
  draft: Doc<"taskDrafts">,
  deleted: boolean,
  updatedAt: number
) {
  await ctx.db.patch(draft._id, { deletedAt: deleted ? updatedAt : null, updatedAt });
}
export const lifecycle = mutation({
  args: { draftId: v.id("taskDrafts"), expectedUpdatedAt: v.number(), deleted: v.boolean() },
  handler: async (ctx, args) => {
    const { draft } = await requireDraft(ctx, args.draftId);
    if (draft.publishedTaskId) throw new ConvexError("Published drafts cannot be changed.");
    const updatedAt = draftRevision(draft.updatedAt, args.expectedUpdatedAt);
    if (args.deleted === (draft.deletedAt !== null)) throw new ConvexError("Draft lifecycle already changed.");
    await changeDraftDeleted(ctx, draft, args.deleted, updatedAt);
  },
});
export const publish = mutation({
  args: { draftId: v.id("taskDrafts"), expectedUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    const { draft } = await requireDraft(ctx, args.draftId);
    if (!draft.projectId) throw new ConvexError("Choose a project before publishing.");
    const { project } = await requireProject(ctx, draft.projectId, true);
    if (draft.publishedTaskId) {
      await requireTask(ctx, draft.publishedTaskId, "read");
      return { taskId: draft.publishedTaskId, projectId: project._id, identifier: project.identifier };
    }
    draftRevision(draft.updatedAt, args.expectedUpdatedAt);
    if (draft.deletedAt !== null) throw new ConvexError("Restore the draft before publishing.");
    await validateDraft(ctx, draft.workspaceId, draft);
    const content = await boundDescriptionContent(ctx, { draftId: draft._id }, draft.html);
    const taskId = await createPreparedTask(
      ctx,
      {
        projectId: project._id,
        title: draft.title,
        description: content.description,
        status: draft.status ?? undefined,
        properties: draft.properties,
        useDefaultState: draft.status === null && draft.properties.stateId === null,
        parent: draft.parent ?? undefined,
        cycle: draft.cycle,
        modules: draft.modules,
      },
      content.html
    );
    await transferDraftAttachments(ctx, draft, taskId);
    await boundDescriptionContent(ctx, taskId, content.html);
    await preserveDescriptionRepresentations(ctx, taskId, draft.descriptionJson, draft.descriptionBinary);
    await ctx.db.patch(draft._id, { publishedTaskId: taskId, updatedAt: Math.max(Date.now(), draft.updatedAt + 1) });
    return { taskId, projectId: project._id, identifier: project.identifier };
  },
});
