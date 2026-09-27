import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireProject } from "../identity/access";
import { requireTask } from "./access";
import { requireTaskRevision } from "./revision";
import { assignCycleTask, removeCycleTask } from "../cycles/tasks";
import { setModuleTask } from "../modules/tasks";
const MAX_BULK_MEMBERSHIPS = 20;
export const change = mutation({
  args: {
    projectId: v.id("projects"),
    tasks: v.array(v.object({ taskId: v.id("tasks"), expectedUpdatedAt: v.number() })),
    target: v.union(
      v.object({ kind: v.literal("cycle"), id: v.id("cycles"), expectedUpdatedAt: v.number() }),
      v.object({ kind: v.literal("module"), id: v.id("modules"), expectedUpdatedAt: v.number() })
    ),
    assigned: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId, true);
    if (
      !args.tasks.length ||
      args.tasks.length > MAX_BULK_MEMBERSHIPS ||
      new Set(args.tasks.map((row) => row.taskId)).size !== args.tasks.length
    )
      throw new ConvexError(`Choose 1–${MAX_BULK_MEMBERSHIPS} distinct tasks.`);
    await Promise.all(
      args.tasks.map(async (row) => {
        const task = await requireTask(ctx, row.taskId);
        if (task.projectId !== args.projectId) throw new ConvexError("All selected tasks must belong to this project.");
        requireTaskRevision(task, row.expectedUpdatedAt);
      })
    );
    // Sequential owner calls preserve cycle capacity checks against earlier writes in this transaction.
    // Any later owner rejection rolls back every membership, task revision and event.
    for (const row of args.tasks) {
      if (args.target.kind === "cycle") {
        const changeCycle = args.assigned ? assignCycleTask : removeCycleTask;
        // oxlint-disable-next-line no-await-in-loop
        await changeCycle(ctx, {
          taskId: row.taskId,
          expectedTaskUpdatedAt: row.expectedUpdatedAt,
          cycleId: args.target.id,
          expectedCycleUpdatedAt: args.target.expectedUpdatedAt,
        });
      } else {
        // oxlint-disable-next-line no-await-in-loop
        await setModuleTask(ctx, {
          taskId: row.taskId,
          expectedTaskUpdatedAt: row.expectedUpdatedAt,
          moduleId: args.target.id,
          expectedModuleUpdatedAt: args.target.expectedUpdatedAt,
          assigned: args.assigned,
        });
      }
    }
    return { selected: args.tasks.length };
  },
});
