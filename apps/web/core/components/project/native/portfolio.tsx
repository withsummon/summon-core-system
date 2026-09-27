import { useEffect, useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { ProjectsPortfolio } from "@/components/summon/projects/projects-portfolio";
import { SummonRequestState } from "@/components/summon/request-state";
import { portfolioProjects } from "./portfolio-data";

type Props = { workspaceId: Id<"workspaces">; workspaceSlug: string; onCreateProject: () => void };
/** Kept outside route registration until the preserved shell and write journeys are ready. */
export function NativeProjectsPortfolio(props: Props) {
  return <PortfolioQueries key={props.workspaceId} {...props} />;
}
function PortfolioQueries({ workspaceId, workspaceSlug, onCreateProject }: Props) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const scope = { workspaceId, projectId: null, clientId: null, dateFrom: null, dateTo: null, today };
  const projects = usePaginatedQuery(api.reporting.projects.page, { scope }, { initialNumItems: 100 });
  const tasks = usePaginatedQuery(api.reporting.tasks.page, { scope }, { initialNumItems: 100 });
  const { status: projectStatus, loadMore: loadProjects } = projects;
  const { status: taskStatus, loadMore: loadTasks } = tasks;
  useEffect(() => {
    if (projectStatus === "CanLoadMore") loadProjects(100);
    if (taskStatus === "CanLoadMore") loadTasks(100);
  }, [projectStatus, loadProjects, taskStatus, loadTasks]);
  const complete = projects.status === "Exhausted" && tasks.status === "Exhausted";
  if (!complete) return <SummonRequestState loading />;
  return (
    <ProjectsPortfolio
      workspaceSlug={workspaceSlug}
      allProjects={portfolioProjects(projects.results, tasks.results)}
      onCreateProject={onCreateProject}
    />
  );
}
