import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { attachmentRevision } from "./task_access";
export async function changeAttachmentState(
  ctx: MutationCtx,
  asset: Doc<"assets">,
  expectedRevision: number,
  deleted: boolean
) {
  const revision = attachmentRevision(asset);
  if (expectedRevision !== revision) throw new ConvexError("Attachment changed. Refresh before trying again.");
  if (asset.status !== (deleted ? "ready" : "deleted"))
    throw new ConvexError("Attachment is not in the expected state.");
  if (!deleted) {
    if (asset.expiresAt <= Date.now()) throw new ConvexError("The attachment restore period has expired.");
    if (!asset.storageId || !(await ctx.db.system.get(asset.storageId)))
      throw new ConvexError("Attachment bytes are missing.");
  }
  await ctx.db.patch(asset._id, {
    status: deleted ? "deleted" : "ready",
    expiresAt: deleted ? Date.now() + 7 * 24 * 60 * 60 * 1000 : asset.expiresAt,
    attachmentRevision: revision + 1,
  });
}
