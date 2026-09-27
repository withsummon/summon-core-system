import { transferDraftAttachments } from "../../assets/draftAttachments";
import { preserveDescriptionRepresentations } from "../description_content";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../../_generated/server";
import { requireWorkspace, requireProject } from "../../identity/access";
import { pageBudget } from "../../commercial/validation";
import { stickyJson } from "../../stickies/content";
import { initialProperties } from "../properties";
import { taskRichContent } from "../rich_content";
import { createPreparedTask } from "../create";
import { requireTask } from "../access";
import { assignCycleTask } from "../../cycles/tasks";
import { setModuleTask } from "../../modules/tasks";
import { draftFields } from "./fields";
import { requireDraft, draftRevision, draftProjectReadable } from "./access";
import { validateDraft } from "./validate";
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
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    const result = await ctx.db
      .query("taskDrafts")
      .withIndex("by_author_workspace", (q) => q.eq("authorId", user._id).eq("workspaceId", args.workspaceId))
      .order("desc")
      .paginate(pageBudget(args.paginationOpts));
    const visible = await Promise.all(
      result.page.map(async (row) => ((await draftProjectReadable(ctx, row, user._id)) ? row : null))
    );
    return {
      ...result,
      page: visible
        .filter((row) => row !== null)
        .filter((row) => !row.publishedTaskId && (row.deletedAt !== null) === args.deleted),
    };
  },
});
export const resolve = query({
  args: { workspaceId: v.id("workspaces"), draftId: v.string() },
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("taskDrafts", args.draftId);
    if (!id) throw new ConvexError("Draft not found.");
    const { draft, member } = await requireDraft(ctx, id);
    if (draft.workspaceId !== args.workspaceId) throw new ConvexError("Draft not found.");
    const project = draft.projectId ? await ctx.db.get(draft.projectId) : null;
    const permission = project ? await requireProject(ctx, project._id) : null;
    return {
      ...draft,
      contentRevision: draft.contentRevision,
      project: project ? { id: project._id, name: project.name, identifier: project.identifier } : null,
      canPublish:
        !draft.deletedAt &&
        !draft.publishedTaskId &&
        member.role !== "guest" &&
        permission?.projectMember.role !== "guest" &&
        !!project,
    };
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
    const updatedAt = Math.max(Date.now(), draft.updatedAt + 1);
    await validateDraft(ctx, draft.workspaceId, args);
    const content = taskRichContent(args.html);
    const htmlChanged = content.html !== draft.html;
    const json =
      args.descriptionJson === undefined
        ? htmlChanged
          ? null
          : draft.descriptionJson
        : stickyJson(args.descriptionJson, "Description JSON", 100000);
    const binary =
      args.descriptionBinary === undefined ? (htmlChanged ? null : draft.descriptionBinary) : args.descriptionBinary;
    if (binary && binary.byteLength > 524288) throw new ConvexError("Description binary must be at most 512 KiB.");
    const { draftId, expectedContentRevision, descriptionJson, descriptionBinary, ...fields } = args;
    await ctx.db.patch(draftId, {
      ...fields,
      ...content,
      descriptionJson: json,
      descriptionBinary: binary,
      contentRevision: draft.contentRevision + 1,
      updatedAt,
    });
  },
});
export const lifecycle = mutation({
  args: { draftId: v.id("taskDrafts"), expectedUpdatedAt: v.number(), deleted: v.boolean() },
  handler: async (ctx, args) => {
    const { draft } = await requireDraft(ctx, args.draftId);
    if (draft.publishedTaskId) throw new ConvexError("Published drafts cannot be changed.");
    const updatedAt = draftRevision(draft.updatedAt, args.expectedUpdatedAt);
    if (args.deleted === (draft.deletedAt !== null)) throw new ConvexError("Draft lifecycle already changed.");
    await ctx.db.patch(draft._id, { deletedAt: args.deleted ? Date.now() : null, updatedAt });
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
    const taskId = await createPreparedTask(
      ctx,
      {
        projectId: project._id,
        title: draft.title,
        description: draft.description,
        status: draft.status ?? undefined,
        properties: draft.properties,
        useDefaultState: draft.status === null && draft.properties.stateId === null,
        parent: draft.parent ?? undefined,
      },
      draft.html
    );
    if (draft.cycle) {
      const task = await requireTask(ctx, taskId);
      await assignCycleTask(ctx, { ...draft.cycle, taskId, expectedTaskUpdatedAt: task.updatedAt });
    }
    // Each relationship advances task CAS in this same transaction.
    for (const ref of draft.modules) {
      // eslint-disable-next-line no-await-in-loop
      const task = await requireTask(ctx, taskId);
      // eslint-disable-next-line no-await-in-loop
      await setModuleTask(ctx, { ...ref, taskId, assigned: true, expectedTaskUpdatedAt: task.updatedAt });
    }
    await preserveDescriptionRepresentations(ctx, taskId, draft.descriptionJson, draft.descriptionBinary);
    await transferDraftAttachments(ctx, draft, taskId);
    await ctx.db.patch(draft._id, { publishedTaskId: taskId, updatedAt: Math.max(Date.now(), draft.updatedAt + 1) });
    return { taskId, projectId: project._id, identifier: project.identifier };
  },
});
