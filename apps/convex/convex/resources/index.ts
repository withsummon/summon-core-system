import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace, requireProject } from "../identity/access";
import { requireDocument, canAccessDocument } from "../documents/access";
import { resourceFields } from "./schema";

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
function validate(fields: Pick<Doc<"resources">, keyof typeof resourceFields>) {
  if (!fields.title.trim() || fields.title.length > 255 || fields.category.length > 80 || fields.url.length > 2048)
    throw new ConvexError("Invalid resource details.");
  let url: URL;
  try {
    url = new URL(fields.url);
  } catch {
    throw new ConvexError("Enter a valid external URL.");
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname)
    throw new ConvexError("Only http and https URLs are allowed.");
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
    validate(args);
    await requireLinks(ctx, args.workspaceId, args, true);
    return ctx.db.insert("resources", {
      ...args,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: Date.now(),
      deleted: false,
    });
  },
});
export const get = query({
  args: { resourceId: v.id("resources") },
  handler: async (ctx, args) => (await requireResource(ctx, args.resourceId)).resource,
});
export const update = mutation({
  args: { resourceId: v.id("resources"), ...resourceFields },
  handler: async (ctx, { resourceId, ...fields }) => {
    const { resource, user } = await requireResource(ctx, resourceId, true);
    validate(fields);
    await requireLinks(ctx, resource.workspaceId, fields, true);
    await ctx.db.patch(resourceId, { ...fields, updatedBy: user._id, updatedAt: Date.now() });
  },
});
export const remove = mutation({
  args: { resourceId: v.id("resources") },
  handler: async (ctx, args) => {
    const { user } = await requireResource(ctx, args.resourceId, true);
    await ctx.db.patch(args.resourceId, { deleted: true, updatedBy: user._id, updatedAt: Date.now() });
  },
});
export const list = query({
  args: { workspaceId: v.id("workspaces"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user } = await requireWorkspace(ctx, args.workspaceId);
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    )
      throw new ConvexError("Choose 1–100 resources.");
    const result = await ctx.db
      .query("resources")
      .withIndex("by_workspace_updated", (q) => q.eq("workspaceId", args.workspaceId).eq("deleted", false))
      .order("desc")
      .paginate({ ...args.paginationOpts, maximumRowsRead: 100, maximumBytesRead: 1_048_576 });
    const visible = await Promise.all(
      result.page.map(async (resource) => {
        const projectId = resource.projectId;
        if (projectId) {
          const project = await ctx.db.get(projectId);
          const member = await ctx.db
            .query("projectMembers")
            .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", user._id))
            .unique();
          if (!project || project.archived || !member?.active) return null;
        }
        if (resource.documentId) {
          const document = await ctx.db.get(resource.documentId);
          if (!document || !(await canAccessDocument(ctx, document, user._id))) return null;
        }
        if (resource.clientId) {
          const client = await ctx.db.get(resource.clientId);
          if (!client || client.deleted) return null;
        }
        return resource;
      })
    );
    return { ...result, page: visible.filter((resource) => resource !== null) };
  },
});
