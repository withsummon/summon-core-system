import type { Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { favoriteTarget } from "./schema";
import { projectReader } from "../savedViews/scope";
import { viewCapabilities } from "../savedViews/access";
import { taskCanRead } from "../tasks/access";
import { canAccessDocument } from "../documents/access";
export type Target = Infer<typeof favoriteTarget>;
export function targetKey(target: Target) {
  return target.type === "folder" ? null : `${target.type}:${target.id}`;
}
type Reader = ReturnType<typeof projectReader>;
async function issueTarget(ctx: QueryCtx, id: Id<"tasks">, member: Doc<"workspaceMembers">, project: Reader) {
  const task = await ctx.db.get(id);
  if (!task || task.workspaceId !== member.workspaceId || !(await taskCanRead(ctx, task, member.userId))) return null;
  const access = await project(task.projectId);
  return access
    ? { name: task.title, projectId: task.projectId, projectIdentifier: access.project.identifier, canFavorite: true }
    : null;
}
async function pageTarget(ctx: QueryCtx, id: Id<"documents">, member: Doc<"workspaceMembers">) {
  const document = await ctx.db.get(id);
  return document &&
    document.workspaceId === member.workspaceId &&
    (await canAccessDocument(ctx, document, member.userId))
    ? { name: document.name, projectId: null, projectIdentifier: null, canFavorite: true }
    : null;
}
function viewFlags(view: Doc<"savedViews">, member: Doc<"workspaceMembers">, access: Awaited<ReturnType<Reader>>) {
  return viewCapabilities(
    view,
    member.userId,
    access ? access.member.role === "admin" : member.role === "admin",
    member.role === "guest" || access?.member.role === "guest",
    !!access?.project.guestViewAllFeatures
  );
}
async function viewTarget(ctx: QueryCtx, id: Id<"savedViews">, member: Doc<"workspaceMembers">, project: Reader) {
  const view = await ctx.db.get(id);
  if (!view || view.workspaceId !== member.workspaceId || view.deletedAt !== null) return null;
  const access = view.projectId ? await project(view.projectId) : null;
  if (view.projectId && !access) return null;
  const flags = viewFlags(view, member, access);
  return flags.canRead
    ? {
        name: view.name,
        projectId: view.projectId,
        projectIdentifier: access?.project.identifier ?? null,
        canFavorite: flags.canFavorite,
      }
    : null;
}
async function groupTarget(ctx: QueryCtx, id: Id<"cycles"> | Id<"modules">, project: Reader) {
  const row = await ctx.db.get(id);
  if (!row || row.deleted) return null;
  const access = await project(row.projectId);
  return access
    ? { name: row.name, projectId: row.projectId, projectIdentifier: access.project.identifier, canFavorite: true }
    : null;
}
// The caller authorizes current workspace membership; every target is resolved afresh.
export async function visibleTarget(ctx: QueryCtx, target: Target, member: Doc<"workspaceMembers">) {
  const project = projectReader(ctx, member.workspaceId, member.userId);
  switch (target.type) {
    case "folder":
      return { name: null, projectId: null, projectIdentifier: null, canFavorite: true };
    case "project": {
      const access = await project(target.id);
      return access
        ? {
            name: access.project.name,
            projectId: access.project._id,
            projectIdentifier: access.project.identifier,
            canFavorite: true,
          }
        : null;
    }
    case "issue":
      return issueTarget(ctx, target.id, member, project);
    case "page":
      return pageTarget(ctx, target.id, member);
    case "view":
      return viewTarget(ctx, target.id, member, project);
    case "cycle":
    case "module":
      return groupTarget(ctx, target.id, project);
  }
}
