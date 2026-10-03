import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireDraft } from "../tasks/drafts/access";
export async function requireDraftAttachmentAccess(ctx: QueryCtx, draftId: Id<"taskDrafts">) {
  const access = await requireDraft(ctx, draftId);
  if (access.draft.deletedAt !== null || access.draft.publishedTaskId)
    throw new ConvexError("Draft attachments are unavailable.");
  return access;
}

export async function draftAttachmentChanged(ctx: MutationCtx, draftId: Id<"taskDrafts">) {
  const { draft } = await requireDraftAttachmentAccess(ctx, draftId);
  await ctx.db.patch(draft._id, { updatedAt: Math.max(Date.now(), draft.updatedAt + 1) });
}

// Live reservations and recoverable files share capacity; closed attempts do not consume it.
export async function liveDraftAssets(ctx: QueryCtx, draftId: Id<"taskDrafts">) {
  const now = Date.now();
  const [ready, pending, deleted] = await Promise.all([
    ctx.db
      .query("assets")
      .withIndex("by_draft_status_expiry", (q) => q.eq("draftId", draftId).eq("status", "ready"))
      .take(101),
    ctx.db
      .query("assets")
      .withIndex("by_draft_status_expiry", (q) => q.eq("draftId", draftId).eq("status", "pending").gt("expiresAt", now))
      .take(101),
    ctx.db
      .query("assets")
      .withIndex("by_draft_status_expiry", (q) => q.eq("draftId", draftId).eq("status", "deleted").gt("expiresAt", now))
      .take(101),
  ]);
  return [...ready, ...pending, ...deleted];
}
