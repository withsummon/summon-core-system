import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { taskChanged } from "./revision";
export function reactionCode(value: string) {
  if (!/^\d{1,7}(?:-\d{1,7}){0,31}$/.test(value)) throw new ConvexError("Choose a supported reaction code.");
  const points = value.split("-").map(Number);
  if (
    points.some(
      (point) =>
        point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff) || point < 32 || (point >= 127 && point <= 159)
    )
  )
    throw new ConvexError("Choose valid Unicode reaction code points.");
  return points.join("-");
}
// Both concrete reaction tables share actor-state idempotence and the task event transaction.
export async function setReaction<T extends Id<"taskReactions"> | Id<"taskCommentReactions">>(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  actorId: Id<"users">,
  existing: { _id: T } | null,
  active: boolean,
  insert: () => Promise<T>
) {
  if (active && existing) return existing._id;
  if (!active && !existing) return null;
  if (existing) {
    await ctx.db.patch(existing._id, { deletedAt: Date.now() });
    await taskChanged(ctx, task, actorId);
    return null;
  }
  const id = await insert();
  await taskChanged(ctx, task, actorId);
  return id;
}
export async function reactionActor<T extends { actorId: Id<"users"> }>(ctx: QueryCtx, row: T, userId: Id<"users">) {
  const actor = await ctx.db.get(row.actorId);
  return { ...row, actorName: actor?.name ?? null, isMine: row.actorId === userId };
}
