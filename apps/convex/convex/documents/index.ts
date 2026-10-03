import { compareValues, ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { stream } from "convex-helpers/server/stream";
import { query, mutation, internalMutation } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  requireWorkspace,
  requireWorkspaceForUser,
  requireProject,
  requireProjectForUser,
  requireUser,
} from "../identity/access";
import { canAccessDocument, requireDocument, requireDocumentForUser, requireMetadataVersion } from "./access";
import { scheduleDocumentReferences } from "./references";
import { documentFields, documentMetadata, snapshotFields, validateDocumentSnapshot } from "./schema";
import schema from "../schema";
import { pageBudget } from "../commercial/validation";
import { renderedProjectLogo } from "../projects/branding_schema";
import { personalImageDescriptor, userAppearance } from "../identity/avatar_owner";

export async function validateDocumentMetadata(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  data: Pick<Doc<"documents">, keyof typeof documentFields>,
  user: Doc<"users">,
  previous?: Doc<"documents">
) {
  renderedProjectLogo(data.logoProps);
  if (data.name.length > 255 || data.category.length > 80 || data.tags.length > 100 || !Number.isFinite(data.sortOrder))
    throw new ConvexError("Invalid document metadata.");
  if (data.projectIds.length > 20 || new Set(data.projectIds).size !== data.projectIds.length)
    throw new ConvexError("Choose up to 20 distinct projects.");
  if (!data.isGlobal && data.projectIds.length === 0 && data.access === "public")
    throw new ConvexError("Public documents need a project or workspace visibility.");
  const visibilityChanged =
    !previous ||
    previous.access !== data.access ||
    previous.isGlobal !== data.isGlobal ||
    compareValues(previous.projectIds, data.projectIds) !== 0;
  const projectIds = new Set(data.projectIds);
  if (previous && visibilityChanged) previous.projectIds.forEach((id) => projectIds.add(id));
  await Promise.all(
    [...projectIds].map(async (projectId) => {
      if (!visibilityChanged && previous?.projectIds.includes(projectId)) return;
      const { project } = await requireProjectForUser(ctx, projectId, user, true);
      if (project.workspaceId !== workspaceId) throw new ConvexError("Project belongs to another workspace.");
    })
  );
  await Promise.all(
    (["clientId", "opportunityId"] as const).map(async (key) => {
      const id = data[key];
      if (!id || (!visibilityChanged && id === previous?.[key])) return;
      const record = await ctx.db.get(id);
      if (!record || record.deleted || record.workspaceId !== workspaceId)
        throw new ConvexError("Context belongs to another workspace.");
    })
  );
}

const createArgs = v.object({ workspaceId: v.id("workspaces"), ...documentFields });
export async function createDocument(ctx: MutationCtx, args: Infer<typeof createArgs>, user: Doc<"users">) {
  await requireWorkspaceForUser(ctx, args.workspaceId, user, true);
  await validateDocumentMetadata(ctx, args.workspaceId, args, user);
  return ctx.db.insert("documents", {
    ...args,
    nameOrder: args.name.toLowerCase(),
    ownedBy: user._id,
    revision: 0,
    isLocked: false,
    archived: false,
    deleted: false,
    updatedAt: Date.now(),
    updatedBy: user._id,
  });
}
export const create = mutation({
  args: createArgs.fields,
  handler: async (ctx, args) => createDocument(ctx, args, await requireUser(ctx)),
});
export const get = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => (await requireDocument(ctx, args.documentId)).document,
});
async function documentContext(
  ctx: QueryCtx,
  { document, user, member }: Awaited<ReturnType<typeof requireDocument>>,
  projectId?: Id<"projects">
) {
  const canWrite =
    member.role !== "guest" &&
    !document.isLocked &&
    !document.archived &&
    (await canAccessDocument(ctx, document, user._id, true, projectId));
  return {
    documentId: document._id,
    userId: user._id,
    name: user.name ?? user.email ?? null,
    documentName: document.name,
    canWrite,
    canManage: member.role !== "guest" && document.ownedBy === user._id,
    logo: renderedProjectLogo(document.logoProps),
  };
}
export const collaborationContext = query({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    const documentId = ctx.db.normalizeId("documents", args.documentId);
    if (!documentId) throw new ConvexError("Document not found.");
    return documentContext(ctx, await requireDocument(ctx, documentId));
  },
});
export const resolve = query({
  args: { workspaceId: v.id("workspaces"), projectId: v.string(), documentId: v.string() },
  handler: async (ctx, args) => {
    const projectId = ctx.db.normalizeId("projects", args.projectId);
    if (!projectId) throw new ConvexError("Project not found.");
    const access = await requireProject(ctx, projectId);
    if (access.workspace._id !== args.workspaceId) throw new ConvexError("Project not found.");
    const documentId = ctx.db.normalizeId("documents", args.documentId);
    const document = documentId ? await ctx.db.get(documentId) : null;
    if (
      !document ||
      document.workspaceId !== args.workspaceId ||
      !document.projectIds.includes(projectId) ||
      !(await canAccessDocument(ctx, document, access.user._id, false, projectId))
    )
      return null;
    return { document, context: await documentContext(ctx, { ...access, document }, projectId) };
  },
});
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    pageType: v.optional(v.union(v.literal("public"), v.literal("private"), v.literal("archived"))),
    search: v.optional(v.string()),
    sortKey: v.optional(v.union(v.literal("name"), v.literal("created_at"), v.literal("updated_at"))),
    sortBy: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireWorkspace(ctx, args.workspaceId);
    const project = args.projectId ? await requireProject(ctx, args.projectId) : null;
    if (project && project.workspace._id !== args.workspaceId) throw new ConvexError("Project not found.");
    const search = (args.search ?? "").toLowerCase();
    const index = {
      name: "by_workspace_name",
      created_at: "by_workspace",
      updated_at: "by_workspace_updated",
    } as const;
    return stream(ctx.db, schema)
      .query("documents")
      .withIndex(index[args.sortKey ?? "created_at"], (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false))
      .order(args.sortBy ?? "desc")
      .filterWith(async (document) => {
        if (args.projectId && !document.projectIds.includes(args.projectId)) return false;
        if (
          args.pageType === "archived"
            ? !document.archived
            : args.pageType && (document.archived || document.access !== args.pageType)
        )
          return false;
        if (!(document.name.trim() ? document.name : "Untitled").toLowerCase().includes(search)) return false;
        return canAccessDocument(ctx, document, access.user._id, false, args.projectId);
      })
      .map(async (document) => {
        const owner = await ctx.db.get(document.ownedBy);
        const membership = await ctx.db
          .query("workspaceMembers")
          .withIndex("by_workspace_user", (q) =>
            q.eq("workspaceId", document.workspaceId).eq("userId", document.ownedBy)
          )
          .unique();
        return {
          document,
          canManage: access.member.role !== "guest" && document.ownedBy === access.user._id,
          logo: renderedProjectLogo(document.logoProps),
          owner: {
            name: owner?.name ?? null,
            avatar: membership?.active
              ? await personalImageDescriptor(
                  ctx,
                  await userAppearance(ctx, document.ownedBy),
                  "avatar",
                  document.workspaceId
                )
              : null,
          },
        };
      })
      .paginate(pageBudget(args.paginationOpts));
  },
});

const updateArgs = v.object({
  documentId: v.id("documents"),
  expectedUpdatedAt: v.number(),
  ...documentMetadata.fields,
});
export async function updateDocumentMetadata(
  ctx: MutationCtx,
  { documentId, expectedUpdatedAt, ...metadata }: Infer<typeof updateArgs>,
  user: Doc<"users">
) {
  const { document } = await requireDocumentForUser(ctx, documentId, user, true);
  requireMetadataVersion(document, expectedUpdatedAt);
  if (document.isLocked || document.archived) throw new ConvexError("Document is locked or archived.");
  const updated = { ...document, ...metadata };
  if (
    document.ownedBy !== user._id &&
    (updated.access !== document.access ||
      updated.isGlobal !== document.isGlobal ||
      compareValues(updated.projectIds, document.projectIds) !== 0)
  )
    throw new ConvexError("Only the owner can change document visibility.");
  await validateDocumentMetadata(ctx, document.workspaceId, updated, user, document);
  if (compareValues(updated, document) === 0) return;
  await ctx.db.patch(documentId, {
    ...metadata,
    updatedBy: user._id,
    updatedAt: Math.max(Date.now(), document.updatedAt + 1),
  });
}
export const update = mutation({
  args: updateArgs.fields,
  handler: async (ctx, args) => updateDocumentMetadata(ctx, args, await requireUser(ctx)),
});
export const setLifecycle = mutation({
  args: {
    documentId: v.id("documents"),
    expectedUpdatedAt: v.number(),
    isLocked: v.boolean(),
    archived: v.boolean(),
    deleted: v.boolean(),
  },
  handler: async (ctx, { documentId, expectedUpdatedAt, ...state }) => {
    const { document, user } = await requireDocument(ctx, documentId, true);
    if (document.ownedBy !== user._id) throw new ConvexError("Only the owner can manage document lifecycle.");
    requireMetadataVersion(document, expectedUpdatedAt);
    await ctx.db.patch(documentId, {
      ...state,
      updatedBy: user._id,
      updatedAt: Math.max(Date.now(), document.updatedAt + 1),
    });
  },
});
// Public saves decode Yjs in the Node action before this transactional writer.
// Hocuspocus merges concurrent bytes before retrying a revision conflict.
const snapshotWrite = v.object({
  documentId: v.id("documents"),
  expectedRevision: v.number(),
  name: v.optional(v.string()),
  ...snapshotFields,
});
export async function saveDocumentSnapshot(ctx: MutationCtx, args: Infer<typeof snapshotWrite>) {
  return saveDocumentSnapshotForUser(ctx, args, await requireUser(ctx));
}
export async function saveDocumentSnapshotForUser(
  ctx: MutationCtx,
  { documentId, expectedRevision, name, ...snapshot }: Infer<typeof snapshotWrite>,
  user: Doc<"users">
) {
  const { document } = await requireDocumentForUser(ctx, documentId, user, true);
  if (document.isLocked || document.archived) throw new ConvexError("Document is locked or archived.");
  if (name !== undefined && name.length > 255) throw new ConvexError("Document name must be at most 255 characters.");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== document.revision)
    throw new ConvexError({
      code: "DOCUMENT_REVISION_CONFLICT",
      message: "Document revision conflict. Reload and merge before retrying.",
    });
  validateDocumentSnapshot(snapshot);
  const revision = expectedRevision + 1;
  const snapshotId = await ctx.db.insert("documentRevisions", {
    ...snapshot,
    documentId,
    revision,
    createdBy: user._id,
  });
  await scheduleDocumentReferences(ctx, { _id: snapshotId, documentId, revision });
  await ctx.db.patch(documentId, {
    revision,
    updatedAt: Math.max(Date.now(), document.updatedAt + 1),
    updatedBy: user._id,
    ...(name === undefined ? {} : { name, nameOrder: name.toLowerCase() }),
  });
  return revision;
}
export const saveSnapshot = internalMutation({ args: snapshotWrite, handler: saveDocumentSnapshot });

export const snapshot = query({
  args: { documentId: v.id("documents"), revision: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { document } = await requireDocument(ctx, args.documentId);
    return ctx.db
      .query("documentRevisions")
      .withIndex("by_document_revision", (q) =>
        q.eq("documentId", args.documentId).eq("revision", args.revision ?? document.revision)
      )
      .unique();
  },
});
