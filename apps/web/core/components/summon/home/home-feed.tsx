/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Circle, FileText } from "lucide-react";
import type { ISummonHomeSummary, ISummonOpportunity, ISummonProjectOverview } from "@plane/types";
import { ViewPanel } from "@/components/summon/screen";
import { SummonSkeletonBlock, SummonSkeletonRows, SummonSkeletonText } from "@/components/summon/skeleton";
import { StatusBadge } from "@/components/summon/status-badge";
import { HomeListSection, IconTile, ProjectMark } from "./home-parts";

export type THomeFilter = "all" | "projects" | "tasks" | "opportunities" | "documents";

/** The project preview panel only exists beside the feed (xl); narrower screens open the project itself. */
const PREVIEW_QUERY = "(min-width: 1280px)";

type THomeFeedProps = {
  workspaceSlug: string;
  /** The home summary is still loading: sections keep their headers and show skeleton rows. */
  loading: boolean;
  filter: THomeFilter;
  showDeals: boolean;
  activeProjectId: string;
  visiblePriority: ISummonHomeSummary["priority"];
  visibleProjects: ISummonHomeSummary["projects"];
  visibleOpportunities: ISummonOpportunity[];
  selectedProject: ISummonProjectOverview | undefined;
  onSelectProject: (projectId: string) => void;
};

export function HomeFeed(props: THomeFeedProps) {
  const {
    workspaceSlug,
    loading,
    filter,
    showDeals,
    activeProjectId,
    visiblePriority,
    visibleProjects,
    visibleOpportunities,
    selectedProject,
    onSelectProject,
  } = props;
  const router = useRouter();
  const showAllOr = (section: THomeFilter) => filter === "all" || filter === section;

  return (
    <ViewPanel value={filter}>
      {showAllOr("tasks") && (
        <HomeListSection
          title="Priority"
          href={`/${workspaceSlug}/summon/tasks/`}
          action="All tasks"
          empty="Nothing urgent right now."
          emptyAsset="work-item"
          skeleton={loading ? <PriorityRowsSkeleton /> : undefined}
        >
          {visiblePriority.slice(0, 3).map((issue) => (
            <Link
              key={issue.id}
              href={`/${workspaceSlug}/projects/${issue.project.id}/issues/${issue.id}/`}
              className="group flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-layer-1"
            >
              <Circle className="size-4 shrink-0 text-danger-secondary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-13 font-medium text-primary" title={issue.name}>
                  {issue.name}
                </span>
                <span className="block truncate text-12 text-tertiary" title={issue.project.name}>
                  {issue.project.name}
                </span>
              </span>
              <StatusBadge status={issue.state?.group ?? "unstarted"} label={issue.state?.name || "Open"} />
            </Link>
          ))}
        </HomeListSection>
      )}

      {showAllOr("projects") && (
        <HomeListSection
          title="Active projects"
          href={`/${workspaceSlug}/summon/projects/`}
          action="All projects"
          empty="No active projects."
          emptyAsset="project"
          skeleton={loading ? <NamedRowsSkeleton count={5} markClassName="size-7 rounded-full" /> : undefined}
        >
          {visibleProjects.slice(0, 5).map((project) => {
            const selected = activeProjectId === project.id;
            return (
              <button
                key={project.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  if (window.matchMedia(PREVIEW_QUERY).matches) onSelectProject(project.id);
                  else router.push(`/${workspaceSlug}/summon/projects/${project.id}/`);
                }}
                className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left ${selected ? "bg-layer-1" : "hover:bg-layer-1"}`}
              >
                <ProjectMark identifier={project.identifier} />
                <span className="min-w-0 flex-1 truncate text-13 font-medium text-primary" title={project.name}>
                  {project.name}
                </span>
                {project.health ? (
                  <StatusBadge status={project.health} />
                ) : (
                  <StatusBadge status="active" label={`${project.completion}%`} />
                )}
              </button>
            );
          })}
        </HomeListSection>
      )}

      {showDeals && showAllOr("opportunities") && (
        <HomeListSection
          title="Opportunities"
          href={`/${workspaceSlug}/summon/opportunities/`}
          action="All opportunities"
          empty="No active opportunities."
          emptyAsset="customer"
          skeleton={loading ? <NamedRowsSkeleton count={3} markClassName="size-6" /> : undefined}
        >
          {visibleOpportunities.slice(0, 3).map((opportunity) => (
            <Link
              key={opportunity.id}
              href={`/${workspaceSlug}/summon/opportunities/${opportunity.id}/`}
              className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-layer-1"
            >
              <IconTile>
                <BriefcaseBusiness className="size-3.5" />
              </IconTile>
              <span className="min-w-0 flex-1 truncate text-13 font-medium text-primary" title={opportunity.title}>
                {opportunity.title}
              </span>
              <StatusBadge status={opportunity.stage} />
            </Link>
          ))}
        </HomeListSection>
      )}

      {filter === "documents" && (
        <HomeListSection
          title="Documents"
          href={`/${workspaceSlug}/summon/knowledge/`}
          action="All documents"
          empty="Select a project to see its documents."
          emptyAsset="note"
        >
          {selectedProject?.pages.slice(0, 5).map((page) => (
            <Link
              key={page.id}
              href={page.href}
              className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-layer-1"
            >
              <IconTile>
                <FileText className="size-3.5" />
              </IconTile>
              <span className="truncate text-13 text-primary" title={page.name}>
                {page.name}
              </span>
            </Link>
          ))}
        </HomeListSection>
      )}
    </ViewPanel>
  );
}

/** Mirrors a priority row: icon, task and project lines, status badge. */
function PriorityRowsSkeleton() {
  return (
    <SummonSkeletonRows
      count={3}
      className="flex flex-col"
      row={(index) => (
        <div key={index} className="flex items-center gap-3 px-2 py-2.5">
          <SummonSkeletonBlock className="size-4 rounded-full" />
          <span className="min-w-0 flex-1">
            <SummonSkeletonText className="text-13 font-medium" width={index % 2 ? "w-40" : "w-56"} />
            <SummonSkeletonText className="text-12" width="w-24" />
          </span>
          <SummonSkeletonBlock className="h-5 w-16 rounded-full" />
        </div>
      )}
    />
  );
}

/** Mirrors a project or opportunity row: a mark, one name line, a badge. */
function NamedRowsSkeleton(props: { count: number; markClassName: string }) {
  return (
    <SummonSkeletonRows
      count={props.count}
      className="flex flex-col"
      row={(index) => (
        <div key={index} className="flex items-center gap-3 px-2 py-2">
          <SummonSkeletonBlock className={props.markClassName} />
          <SummonSkeletonText className="min-w-0 flex-1 text-13 font-medium" width={index % 2 ? "w-32" : "w-44"} />
          <SummonSkeletonBlock className="h-5 w-14 rounded-full" />
        </div>
      )}
    />
  );
}
