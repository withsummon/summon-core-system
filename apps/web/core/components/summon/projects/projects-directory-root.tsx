/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState, useMemo } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import Link from "next/link";
import { FolderGit2, Circle, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { Button } from "@plane/propel/button";
import { Select } from "@plane/propel/select";
import { capitalizeFirstLetter, replaceUnderscoreIfSnakeCase } from "@plane/utils";
import { summonService } from "@/services/summon.service";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonPageHeader } from "@/components/summon/screen";
import { SummonSkeletonBlock, SummonSkeletonRows, SummonSkeletonText } from "@/components/summon/skeleton";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useProject } from "@/hooks/store/use-project";
import { mergeProjectSummaries } from "./project-workspace";
import { SummonSearchField } from "@/components/summon/search-field";

export const ProjectsDirectoryRoot = observer(function ProjectsDirectoryRoot({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  const { toggleCreateProjectModal } = useCommandPalette();
  const { joinedProjectIds, getProjectById } = useProject();
  const { data, error, mutate } = useSWR(["summon-home", workspaceSlug], () =>
    summonService.getHomeSummary(workspaceSlug)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [healthFilter, setHealthFilter] = useState("all");
  const storeProjects = joinedProjectIds.map((id) => getProjectById(id)).filter((project) => project !== undefined);
  const allProjects = mergeProjectSummaries(data?.projects ?? [], storeProjects);

  useEffect(() => {
    if (data && allProjects.length > data.projects.length) void mutate();
  }, [allProjects.length, data, mutate]);

  const healthOptions = useMemo(
    () => [
      { value: "all", label: "All health statuses" },
      ...Array.from(
        new Set(data?.projects.map((project) => project.health).concat("not_assessed") ?? ["not_assessed"])
      ).map((health) => ({ value: health, label: capitalizeFirstLetter(replaceUnderscoreIfSnakeCase(health)) })),
    ],
    [data?.projects]
  );
  const query = searchQuery.trim().toLowerCase();
  const projects = allProjects.filter(
    (project) =>
      (!query || `${project.name} ${project.identifier}`.toLowerCase().includes(query)) &&
      (healthFilter === "all" || project.health === healthFilter)
  );

  return (
    <div className="min-h-full bg-surface-1">
      <div className="border-b border-subtle px-4 py-3 sm:px-6">
        <SummonPageHeader
          title="Projects"
          description={
            data ? (
              <span className="tabular-nums">{`${allProjects.length} ${allProjects.length === 1 ? "project" : "projects"}`}</span>
            ) : (
              <SummonSkeletonText width="w-16" />
            )
          }
          actions={
            <Button size="lg" prependIcon={<Plus aria-hidden="true" />} onClick={() => toggleCreateProjectModal(true)}>
              New project
            </Button>
          }
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-subtle px-4 py-3 sm:px-6">
        <SummonSearchField
          label="Search projects"
          placeholder="Search projects…"
          value={searchQuery}
          onValueChange={setSearchQuery}
          className="w-full sm:w-64"
        />
        <Select
          aria-label="Filter projects by health"
          value={healthFilter}
          onValueChange={setHealthFilter}
          options={healthOptions}
          className="w-auto min-w-44"
        />
        <span role="status" className="ml-auto text-xs text-secondary tabular-nums">
          {data ? `${projects.length} ${projects.length === 1 ? "project" : "projects"}` : null}
        </span>
      </div>
      <div
        className="hidden grid-cols-[minmax(0,1fr)_11rem_10rem] gap-6 border-b border-subtle bg-layer-1 px-6 py-2 text-xs text-secondary md:grid"
        aria-hidden="true"
      >
        <span>Name</span>
        <span>Health</span>
        <span>Completion</span>
      </div>
      <ul aria-label="Projects" className="divide-y divide-subtle">
        {projects.map((project) => {
          const healthy = project.health === "on_track" || project.health === "good";
          const atRisk = ["at_risk", "off_track", "delayed"].includes(project.health);
          const HealthIcon = healthy ? CheckCircle2 : atRisk ? AlertCircle : Circle;
          return (
            <li key={project.id}>
              <Link
                href={`/${workspaceSlug}/summon/projects/${project.id}/`}
                className="group grid grid-cols-1 gap-3 px-4 py-3 transition-colors hover:bg-layer-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong focus-visible:outline-solid sm:px-6 md:grid-cols-[minmax(0,1fr)_11rem_10rem] md:items-center md:gap-6"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md border border-subtle bg-layer-1 text-secondary">
                    <FolderGit2 aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium break-words text-primary">{project.name}</span>
                    <span className="text-xs text-secondary">{project.identifier}</span>
                  </span>
                </span>
                <span
                  className={`inline-flex items-center gap-2 text-xs ${healthy ? "text-success-primary" : atRisk ? "text-warning-primary" : "text-secondary"}`}
                >
                  <HealthIcon aria-hidden="true" className="size-3.5 shrink-0" />
                  {capitalizeFirstLetter(replaceUnderscoreIfSnakeCase(project.health))}
                </span>
                <span className="flex items-center gap-3">
                  <span aria-hidden="true" className="h-1.5 w-24 overflow-hidden rounded-full bg-layer-2">
                    <span
                      className="block h-full rounded-full bg-accent-primary"
                      style={{ width: `${project.completion}%` }}
                    />
                  </span>
                  <span className="text-xs text-secondary tabular-nums">
                    {project.completion}%<span className="sr-only"> complete</span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!data ? (
        error ? (
          <div className="p-4 sm:px-6">
            <SummonRequestState error={error} onRetry={() => void mutate()} />
          </div>
        ) : (
          <ProjectRowsSkeleton />
        )
      ) : null}
      {data && !projects.length && (
        <SummonRequestState
          empty
          emptyAsset={allProjects.length ? "search" : "project"}
          emptyTitle={allProjects.length ? "No matching projects" : "No projects yet"}
          emptyMessage={
            allProjects.length ? "Try another name or health status." : "Create a project to start planning your work."
          }
          emptyAction={
            allProjects.length > 0 && (
              <Button
                variant="secondary"
                size="base"
                onClick={() => {
                  setSearchQuery("");
                  setHealthFilter("all");
                }}
              >
                Clear filters
              </Button>
            )
          }
        />
      )}
    </div>
  );
});

/** Mirrors a project row: folder tile, name and identifier, health, completion bar. */
function ProjectRowsSkeleton() {
  return (
    <SummonSkeletonRows
      count={6}
      className="divide-y divide-subtle"
      label="Loading projects"
      row={(index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-3 px-4 py-3 sm:px-6 md:grid-cols-[minmax(0,1fr)_11rem_10rem] md:items-center md:gap-6"
        >
          <span className="flex min-w-0 items-center gap-3">
            <SummonSkeletonBlock className="size-8" />
            <span className="min-w-0 flex-1">
              <SummonSkeletonText className="text-sm font-medium" width={index % 2 ? "w-40" : "w-56"} />
              <SummonSkeletonText className="text-xs" width="w-12" />
            </span>
          </span>
          <SummonSkeletonText className="text-xs" width="w-20" />
          <span className="flex items-center gap-3">
            <SummonSkeletonBlock className="h-1.5 w-24 rounded-full" />
            <SummonSkeletonText className="text-xs" width="w-8" />
          </span>
        </div>
      )}
    />
  );
}
