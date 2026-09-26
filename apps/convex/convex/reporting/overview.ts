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
        .take(20),
    ]);
    return {
      project: { id: selectedProject._id, name: selectedProject.name, identifier: selectedProject.identifier },
      profile: profile && !profile.deleted ? profile : null,
      recentTasks: tasks.map((task) => ({
        id: task._id,
        title: task.title,
        sequence: task.sequence,
        status: task.status,
        targetDate: task.targetDate,
      })),
      coverage: {
        recentTasksLimit: 20,
        totals: "Use reporting.tasks.page contributions",
        omitted: ["milestones", "activity", "resources", "files", "meetings", "pages"],
      },
    };
  },
});
