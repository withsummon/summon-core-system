/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState, useMemo } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import Link from "next/link";
import { Search, FolderGit2, Circle, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { Select } from "@plane/propel/select";
import { summonService } from "@/services/summon.service";
import { SummonRequestState } from "@/components/summon/request-state";
import { useCommandPalette } from "@/hooks/store/use-command-palette";
import { useProject } from "@/hooks/store/use-project";
import { mergeProjectSummaries, projectHealthLabel } from "./project-workspace";

export const ProjectsDirectoryRoot = observer(function ProjectsDirectoryRoot({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  const { toggleCreateProjectModal } = useCommandPalette();
  const { joinedProjectIds, getProjectById } = useProject();
  const { data, error, isLoading, mutate } = useSWR(["summon-projects", workspaceSlug], () =>
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
      ).map((health) => ({ value: health, label: projectHealthLabel(health) })),
    ],
    [data?.projects]
  );
  const query = searchQuery.trim().toLowerCase();
  const projects = allProjects.filter(
    (project) =>
      (!query || `${project.name} ${project.identifier}`.toLowerCase().includes(query)) &&
      (healthFilter === "all" || project.health === healthFilter)
  );

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  return (
    <div className="min-h-full bg-surface-1">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <FolderGit2 aria-hidden="true" className="size-4 text-secondary" />
          <h1 className="text-sm font-semibold text-primary">Projects</h1>
          <span className="text-xs rounded bg-layer-2 px-1.5 py-0.5 text-secondary tabular-nums">
            {allProjects.length}
          </span>
        </div>
        <Button size="base" prependIcon={<Plus aria-hidden="true" />} onClick={() => toggleCreateProjectModal(true)}>
          New project
        </Button>
      </header>
      <div className="flex flex-wrap items-center gap-3 border-b border-subtle px-4 py-3 sm:px-6">
        <div className="relative w-full sm:w-64">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-secondary"
          />
          <Input
            aria-label="Search projects"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search projects…"
            className="text-base sm:text-sm w-full pl-8"
          />
        </div>
        <Select
          aria-label="Filter projects by health"
          value={healthFilter}
          onValueChange={setHealthFilter}
          options={healthOptions}
          className="w-auto min-w-44"
        />
        <span role="status" className="text-xs ml-auto text-secondary tabular-nums">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </span>
      </div>
      <div
        className="text-xs hidden grid-cols-[minmax(0,1fr)_11rem_10rem] gap-6 border-b border-subtle bg-layer-1 px-6 py-2 text-secondary md:grid"
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
                className="group grid grid-cols-1 gap-3 px-4 py-3 transition-colors hover:bg-layer-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-strong sm:px-6 md:grid-cols-[minmax(0,1fr)_11rem_10rem] md:items-center md:gap-6"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md border border-subtle bg-layer-1 text-secondary">
                    <FolderGit2 aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="text-sm block font-medium break-words text-primary">{project.name}</span>
                    <span className="text-xs text-secondary">{project.identifier}</span>
                  </span>
                </span>
                <span
                  className={`text-xs inline-flex items-center gap-2 ${healthy ? "text-success-primary" : atRisk ? "text-warning-primary" : "text-secondary"}`}
                >
                  <HealthIcon aria-hidden="true" className="size-3.5 shrink-0" />
                  {projectHealthLabel(project.health)}
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
      {!projects.length && (
        <div className="px-6 py-16 text-center">
          <FolderGit2 aria-hidden="true" className="mx-auto mb-3 size-6 text-secondary" />
          <h2 className="text-sm font-medium text-primary">
            {allProjects.length ? "No matching projects" : "No projects yet"}
          </h2>
          <p className="text-sm mt-1 text-secondary">
            {allProjects.length
              ? "Try another name or health status."
              : "Create a project to start planning your work."}
          </p>
          {allProjects.length > 0 && (
            <Button
              variant="secondary"
              size="base"
              className="mt-4"
              onClick={() => {
                setSearchQuery("");
                setHealthFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
});
