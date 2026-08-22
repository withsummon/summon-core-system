/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Input } from "@plane/ui";
import Link from "next/link";
import useSWR from "swr";
import { SummonRequestState } from "@/components/summon/request-state";
import { SummonCard, SummonScreen } from "@/components/summon/screen";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonProjectsPage({ params }: Route.ComponentProps) {
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState("all");
  const { data, error, isLoading, mutate } = useSWR(["summon-projects", params.workspaceSlug], () =>
    summonService.getHomeSummary(params.workspaceSlug)
  );

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  const normalizedQuery = query.trim().toLowerCase();
  const projects = data.projects.filter(
    (project) =>
      (health === "all" || project.health === health) &&
      (!normalizedQuery || `${project.identifier} ${project.name}`.toLowerCase().includes(normalizedQuery))
  );
  const healthOptions = [...new Set(data.projects.map((project) => project.health))];

  return (
    <SummonScreen title="Projects" description="Authorized Plane projects, with delivery health at a glance.">
      <SummonCard>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            aria-label="Search projects"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
          />
          <label className="sr-only" htmlFor="project-health">
            Filter by health
          </label>
          <select
            id="project-health"
            value={health}
            onChange={(event) => setHealth(event.target.value)}
            className="text-sm h-9 rounded-lg border border-subtle bg-layer-1 px-3 text-primary"
          >
            <option value="all">All health</option>
            {healthOptions.map((option) => (
              <option key={option} value={option}>
                {option.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </SummonCard>
      <SummonRequestState
        empty={projects.length === 0}
        emptyMessage={data.projects.length ? "No projects match these filters." : "No accessible projects yet."}
      />
      {projects.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/${params.workspaceSlug}/summon/projects/${project.id}/`}
              className="rounded-2xl border border-subtle bg-surface-1 p-4 shadow-[0_8px_30px_rgba(36,55,99,0.035)] focus-visible:outline focus-visible:outline-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm truncate font-semibold text-primary">{project.name}</p>
                  <p className="mt-1 text-[11px] text-secondary">{project.identifier}</p>
                </div>
                <span className="rounded-full bg-accent-subtle px-2 py-1 text-[10px] font-medium text-accent-primary">
                  {project.health.replaceAll("_", " ")}
                </span>
              </div>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-layer-2">
                <div className="h-full rounded-full bg-accent-primary" style={{ width: `${project.completion}%` }} />
              </div>
              <p className="text-xs mt-2 text-secondary">{project.completion}% complete</p>
            </Link>
          ))}
        </div>
      ) : null}
    </SummonScreen>
  );
}
