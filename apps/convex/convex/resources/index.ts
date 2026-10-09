import { requireCredential, credentialMetadataAccess } from "../mcp/access";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace, requireProject } from "../identity/access";
import { requireDocument, canAccessDocument } from "../documents/access";
import { resourceFields } from "./schema";
import { stream } from "convex-helpers/server/stream";
import schema from "../schema";

async function requireLinks(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  fields: Pick<Doc<"resources">, keyof typeof resourceFields>,
  write: boolean
) {
  if (fields.projectId) {
    const { project } = await requireProject(ctx, fields.projectId, write);
    if (project.workspaceId !== workspaceId) throw new ConvexError("Project belongs to another workspace.");
  }
  if (fields.documentId) {
    const { document } = await requireDocument(ctx, fields.documentId, write);
    if (document.workspaceId !== workspaceId) throw new ConvexError("Document belongs to another workspace.");
  }
  if (fields.clientId) {
    const client = await ctx.db.get(fields.clientId);
    if (!client || client.deleted || client.workspaceId !== workspaceId)
      throw new ConvexError("Client belongs to another workspace.");
  }
}
async function validateCredentialLink(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  credentialId: Id<"mcpCredentials"> | null | undefined
) {
  if (!credentialId) return;
  const { credential } = await requireCredential(ctx, credentialId);
  if (credential.workspaceId !== workspaceId) throw new ConvexError("Credential belongs to another workspace.");
}
async function resourceProjection(ctx: QueryCtx, resource: Doc<"resources">, userId: Id<"users">) {
  const credential = resource.credentialId ? await ctx.db.get(resource.credentialId) : null;
  const available =
    credential &&
    credential.workspaceId === resource.workspaceId &&
    (await credentialMetadataAccess(ctx, credential, userId));
  return {
    ...resource,
    credentialId: available ? credential._id : null,
    credentialName: available ? credential.name : null,
    credentialUnavailable: Boolean(resource.credentialId && !available),
  };
}
function validate(fields: Pick<Doc<"resources">, keyof typeof resourceFields>) {
  if (
    !fields.title.trim() ||
    fields.title.length > 255 ||
    fields.category.length > 80 ||
    fields.url.length > 2048 ||
    fields.description.length > 10000
  )
    throw new ConvexError("Invalid resource details.");
  let url: URL;
  try {
    url = new URL(fields.url);
  } catch {
    throw new ConvexError("Enter a valid external URL.");
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password)
    throw new ConvexError("Use an http or https URL without embedded credentials.");
  if (url.href.length > 2048) throw new ConvexError("Resource URL exceeds 2048 characters.");
  return { ...fields, title: fields.title.trim(), category: fields.category.trim(), url: url.href };
}
async function requireResource(ctx: QueryCtx, resourceId: Id<"resources">, write = false) {
  const resource = await ctx.db.get(resourceId);
  if (!resource || resource.deleted) throw new ConvexError("Resource not found.");
  const access = await requireWorkspace(ctx, resource.workspaceId, write);
  await requireLinks(ctx, resource.workspaceId, resource, write);
  return { ...access, resource };
}
export const create = mutation({
  args: { workspaceId: v.id("workspaces"), ...resourceFields },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    await validateCredentialLink(ctx, args.workspaceId, args.credentialId);
    const fields = validate(args);
    await requireLinks(ctx, args.workspaceId, args, true);
    return ctx.db.insert("resources", {
      ...fields,
      credentialId: fields.credentialId ?? null,
      workspaceId: args.workspaceId,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: Date.now(),
      deleted: false,
    });
  },
});
export const get = query({
  args: { resourceId: v.id("resources") },
  handler: async (ctx, args) => {
    const { resource, user } = await requireResource(ctx, args.resourceId);
    return resourceProjection(ctx, resource, user._id);
  },
});
export const update = mutation({
  args: { resourceId: v.id("resources"), expectedUpdatedAt: v.number(), ...resourceFields },
  handler: async (ctx, { resourceId, expectedUpdatedAt, ...fields }) => {
    const { resource, user } = await requireResource(ctx, resourceId, true);
    if (resource.updatedAt !== expectedUpdatedAt)
      throw new ConvexError("This resource changed. Reopen the editor before saving.");
    const nextFields = {
      ...fields,
      credentialId: fields.credentialId === undefined ? (resource.credentialId ?? null) : fields.credentialId,
    };
    if (nextFields.credentialId !== resource.credentialId)
      await validateCredentialLink(ctx, resource.workspaceId, nextFields.credentialId);
    const validated = validate(nextFields);
    await requireLinks(ctx, resource.workspaceId, nextFields, true);
    await ctx.db.patch(resourceId, {
      ...validated,
      updatedBy: user._id,
      updatedAt: Math.max(Date.now(), resource.updatedAt + 1),
    });
  },
});
export const remove = mutation({
  args: { resourceId: v.id("resources") },
  handler: async (ctx, args) => {
    const { user, resource } = await requireResource(ctx, args.resourceId, true);
    await ctx.db.patch(args.resourceId, {
      deleted: true,
      updatedBy: user._id,
      updatedAt: Math.max(Date.now(), resource.updatedAt + 1),
    });
  },
});
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    projectId: v.optional(v.id("projects")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    if (args.projectId) {
      const { project } = await requireProject(ctx, args.projectId);
      if (project.workspaceId !== args.workspaceId) throw new ConvexError("Project belongs to another workspace.");
    }
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    )
      throw new ConvexError("Choose 1–100 resources.");
    return stream(ctx.db, schema)
      .query("resources")
      .withIndex("by_workspace_updated", (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false))
      .order("desc")
      .map(async (resource) => {
        if (args.projectId && resource.projectId !== args.projectId) return null;
        const projectId = resource.projectId;
        const project = projectId ? await ctx.db.get(projectId) : null;
        if (projectId) {
          const member = await ctx.db
            .query("projectMembers")
            .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", user._id))
            .unique();
          if (!project || project.archived || project.deletedAt != null || !member?.active) return null;
        }
        if (resource.documentId) {
          const document = await ctx.db.get(resource.documentId);
          if (!document || !(await canAccessDocument(ctx, document, user._id))) return null;
        }
        if (resource.clientId) {
          const client = await ctx.db.get(resource.clientId);
          if (!client || client.deleted) return null;
        }
        const updatedBy = await ctx.db.get(resource.updatedBy);
        return Object.assign(await resourceProjection(ctx, resource, user._id), {
          projectName: project?.name ?? null,
          updatedByName: updatedBy?.name ?? null,
        });
      })
      .paginate({ ...args.paginationOpts, maximumRowsRead: 100, maximumBytesRead: 1_048_576 });
  },
});

export const detail = query({
  args: { workspaceId: v.id("workspaces"), resourceId: v.string() },
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.workspaceId);
    const resourceId = ctx.db.normalizeId("resources", args.resourceId);
    if (!resourceId) throw new ConvexError("Resource not found.");
    const { resource, user, member } = await requireResource(ctx, resourceId);
    if (resource.workspaceId !== args.workspaceId) throw new ConvexError("Resource not found in this workspace.");
    const project = resource.projectId ? await requireProject(ctx, resource.projectId) : null;
    const document = resource.documentId ? (await requireDocument(ctx, resource.documentId)).document : null;
    const client = resource.clientId ? await ctx.db.get(resource.clientId) : null;
    const canWrite =
      member.role !== "guest" &&
      (!project || project.projectMember.role !== "guest") &&
      (!document || (await canAccessDocument(ctx, document, user._id, true)));
    return {
      resource: await resourceProjection(ctx, resource, user._id),
      canWrite,
      projectName: project?.project.name ?? null,
      documentName: document?.name ?? null,
      clientName: client?.name ?? null,
    };
  },
});
export const documentOptions = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId, true);
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    )
      throw new ConvexError("Choose 1–100 documents.");
    const result = await ctx.db
      .query("documents")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false))
      .paginate({ ...args.paginationOpts, maximumRowsRead: 100, maximumBytesRead: 1_048_576 });
    const options = await Promise.all(
      result.page.map(async (document) =>
        (await canAccessDocument(ctx, document, user._id, true)) ? { id: document._id, name: document.name } : null
      )
    );
    return { ...result, page: options.filter((option) => option !== null) };
  },
});
