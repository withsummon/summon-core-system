import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { PortfolioProject } from "@/components/summon/projects/projects-portfolio";

type ProjectContribution = FunctionReturnType<typeof api.reporting.projects.page>["contribution"];
type TaskContribution = FunctionReturnType<typeof api.reporting.tasks.page>["contribution"];
export function portfolioProjects(projects: ProjectContribution[], tasks: TaskContribution[]): PortfolioProject[] {
  const totals: Record<string, { total: number; completed: number }> = {};
  for (const page of tasks)
    for (const [id, value] of Object.entries(page.projects)) {
      const current = (totals[id] ??= { total: 0, completed: 0 });
      current.total += value.total;
      current.completed += value.completed;
    }
  return projects
    .flatMap((page) => page.projects)
    .map((project) => {
      const counts = totals[project.id];
      return {
        id: project.id,
        name: project.name,
        identifier: project.identifier,
        health: project.health,
        completion: counts?.total ? Math.round((counts.completed / counts.total) * 100) : 0,
      };
    });
}
