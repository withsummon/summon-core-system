import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { requireAssetScope } from "../assets/access";
import { requireUser, requireWorkspaceForUser } from "../identity/access";
import { projectReader } from "../savedViews/scope";
import { taskRoleCanReadAll } from "../tasks/access";

// Whole-project archives cannot be authorized by a guest's access to just their own tasks.
export function exportProjectReader(ctx: QueryCtx, access: Awaited<ReturnType<typeof requireWorkspaceForUser>>) {
  const read = projectReader(ctx, access.workspace._id, access.user._id);
  return async (projectId: Id<"projects">) => {
    const scope = await read(projectId);
    return scope && taskRoleCanReadAll(access.member.role, scope.member.role, !!scope.project.guestViewAllFeatures)
      ? scope.project
      : null;
  };
}
export async function requireExportForUser(ctx: QueryCtx, job: Doc<"workspaceExports">, user: Doc<"users">) {
  const access = await requireWorkspaceForUser(ctx, job.workspaceId, user, true);
  const read = exportProjectReader(ctx, access);
  const projects = await Promise.all([...new Set([...job.projectIds, ...job.sourceProjectIds])].map(read));
  if (projects.some((project) => project === null)) throw new ConvexError("Export project access changed.");
  return { ...access, job };
}
export async function requireExport(
  ctx: QueryCtx,
  scope: Parameters<typeof requireAssetScope>[1],
  jobId: Id<"workspaceExports">,
  write: boolean
) {
  if (
    write ||
    [
      scope.projectId,
      scope.documentId,
      scope.taskId,
      scope.draftId,
      scope.conversationId,
      scope.commentUpload,
      scope.commentId,
      scope.meetingId,
      scope.automationJobId,
      scope.avatarUserId,
      scope.documentCopyId,
      scope.purpose,
      scope.projectCoverFormRevision !== undefined,
    ].some(Boolean)
  )
    throw new ConvexError("Export files require only their job scope.");
  const job = await ctx.db.get(jobId);
  if (!job || job.status !== "completed" || job.expiresAt <= Date.now())
    throw new ConvexError("Export is unavailable or expired.");
  if (job.workspaceId !== scope.workspaceId || job.assetId !== scope._id)
    throw new ConvexError("Export file scope mismatch.");
  return requireExportForUser(ctx, job, await requireUser(ctx));
}
