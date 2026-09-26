import type { MutationCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { requireProject } from "../identity/access";
import { requireTask } from "./properties";
export async function changeTaskStatus(
  ctx: MutationCtx,
  args: { taskId: Id<"tasks">; status: Doc<"tasks">["status"] }
) {
  const task = await requireTask(ctx, args.taskId);
  const { user } = await requireProject(ctx, task.projectId, true);
  if (task.status === args.status) return;
  await ctx.db.patch(task._id, {
    status: args.status,
    stateId: null,
    completedAt: args.status === "done" ? Date.now() : null,
    updatedAt: Math.max(Date.now(), task.updatedAt + 1),
  });
  await ctx.db.insert("taskEvents", {
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    taskId: task._id,
    actorId: user._id,
    kind: "status_changed",
    status: args.status,
  });
}
