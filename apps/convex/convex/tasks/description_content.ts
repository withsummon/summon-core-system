import { ConvexError, v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { plainDescriptionHtml } from "./rich_content";

export const contentVersion = v.union(
  v.null(),
  v.object({ versionId: v.id("taskDescriptionVersions"), revision: v.number() })
);
export async function latestDescriptionVersion(ctx: QueryCtx, taskId: Id<"tasks">) {
  return ctx.db
    .query("taskDescriptionVersions")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .order("desc")
    .first();
}
export async function descriptionVersion(ctx: QueryCtx, taskId: Id<"tasks">) {
  const version = await latestDescriptionVersion(ctx, taskId);
  return version ? { versionId: version._id, revision: version.revision } : null;
}
export async function requireDescriptionVersion(
  ctx: QueryCtx,
  taskId: Id<"tasks">,
  expected: Awaited<ReturnType<typeof descriptionVersion>>
) {
  const current = await descriptionVersion(ctx, taskId);
  if (current?.versionId !== expected?.versionId || current?.revision !== expected?.revision)
    throw new ConvexError("Description changed. Reopen the latest description before saving.");
}

// Caller owns authorization and task CAS; content and history commit in that same transaction.
export async function writeDescription(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  actorId: Id<"users">,
  content: { html: string; description: string },
  creating = false
) {
  const rich = await ctx.db
    .query("taskDescriptions")
    .withIndex("by_task", (q) => q.eq("taskId", task._id))
    .unique();
  const unchanged = (rich?.html ?? plainDescriptionHtml(task.description)) === content.html;
  if (!creating && unchanged) return;
  if (rich)
    await ctx.db.patch(rich._id, { html: content.html, descriptionJson: undefined, descriptionBinary: undefined });
  else await ctx.db.insert("taskDescriptions", { taskId: task._id, html: content.html });
  await ctx.db.patch(task._id, { description: content.description });
  const latest = await latestDescriptionVersion(ctx, task._id);
  const now = Date.now();
  const data = { html: content.html, description: content.description, lastSavedAt: now };
  if (latest && latest.actorId === actorId && now - latest.lastSavedAt <= 600000) {
    await ctx.db.patch(latest._id, { ...data, revision: latest.revision + 1 });
  } else await ctx.db.insert("taskDescriptionVersions", { taskId: task._id, actorId, ...data, revision: 0 });
}

// Opaque imported editor payloads are preserved only alongside their original HTML.
// Normal HTML/plain writes above clear them, since no native roundtrip converter owns these formats.
export async function preserveDescriptionRepresentations(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  descriptionJson: unknown,
  descriptionBinary: ArrayBuffer | null
) {
  const rich = await ctx.db
    .query("taskDescriptions")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .unique();
  if (!rich) throw new Error("Task description must exist before preserving editor representations.");
  await ctx.db.patch(rich._id, {
    descriptionJson: descriptionJson ?? undefined,
    descriptionBinary: descriptionBinary ?? undefined,
  });
}
