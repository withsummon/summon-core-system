import { taskChanged } from "./revision";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import type { Infer } from "convex/values";
import { status } from "./schema";
import { requireTask } from "./access";
export async function changeTaskStatus(ctx: MutationCtx, args: { taskId: Id<"tasks">; status: Infer<typeof status> }) {
  const task = await requireTask(ctx, args.taskId);
  const { user } = await requireProject(ctx, task.projectId, true);
  if (task.status === args.status) return;
  await ctx.db.patch(task._id, {
    status: args.status,
    stateId: null,
    completedAt: args.status === "done" ? Date.now() : null,
  });
  await taskChanged(ctx, task, user._id);
}
