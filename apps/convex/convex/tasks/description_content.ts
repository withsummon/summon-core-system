import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { plainDescriptionHtml } from "./rich_content";

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
  if (rich) await ctx.db.patch(rich._id, { html: content.html });
  else await ctx.db.insert("taskDescriptions", { taskId: task._id, html: content.html });
  await ctx.db.patch(task._id, { description: content.description });
  const latest = await ctx.db
    .query("taskDescriptionVersions")
    .withIndex("by_task", (q) => q.eq("taskId", task._id))
    .order("desc")
    .first();
  const now = Date.now();
  const data = { html: content.html, description: content.description, lastSavedAt: now };
  if (latest && latest.actorId === actorId && now - latest.lastSavedAt <= 600000) {
    await ctx.db.patch(latest._id, { ...data, revision: latest.revision + 1 });
  } else await ctx.db.insert("taskDescriptionVersions", { taskId: task._id, actorId, ...data, revision: 0 });
}
