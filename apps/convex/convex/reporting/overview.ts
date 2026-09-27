import { taskIsActive } from "../tasks/access";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireProject } from "../identity/access";

export const project = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const { project: selectedProject } = await requireProject(ctx, projectId);
    const [profile, tasks] = await Promise.all([
      ctx.db
        .query("projectProfiles")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .unique(),
      ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .order("desc")
        .paginate({
          cursor: null,
          numItems: 100,
          maximumRowsRead: 100,
          maximumBytesRead: 1_000_000,
        }),
    ]);
    return {
      project: {
        id: selectedProject._id,
        name: selectedProject.name,
        identifier: selectedProject.identifier,
      },
      profile: profile && !profile.deleted ? profile : null,
      recentTasks: tasks.page
        .filter(taskIsActive)
        .slice(0, 20)
        .map((task) => ({
          id: task._id,
          title: task.title,
          sequence: task.sequence,
          status: task.status,
          targetDate: task.targetDate,
        })),
      coverage: {
        recentTasksLimit: 20,
        scannedTaskCandidates: tasks.page.length,
        hasMoreTaskCandidates: !tasks.isDone,
        totals: "Use reporting.tasks.page contributions",
        omitted: ["milestones", "activity", "resources", "files", "meetings", "pages"],
      },
    };
  },
});
