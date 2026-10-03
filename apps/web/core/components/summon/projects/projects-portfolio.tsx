/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  FolderGit2,
  CheckCircle,
  AlertCircle,
  Clock,
  LayoutGrid,
  List,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { Select } from "@plane/propel/select";

import type { Doc } from "@summon/convex/data-model";
import { projectHealth } from "@summon/convex/commercial-schema";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
type Props = {
  workspaceSlug: string;
  allProjects: FunctionReturnType<typeof api.projects.index.list>;
  progress: FunctionReturnType<typeof api.reporting.tasks.page>["contribution"]["projects"];
  totalsReady: boolean;
  onCreateProject: (() => void) | null;
};

const healthLabels = {
  not_assessed: {
    label: "Belum dinilai",
    icon: Clock,
    className: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  },
  on_track: {
    label: "On Track",
    icon: CheckCircle,
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  at_risk: { label: "At Risk", icon: AlertCircle, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  off_track: { label: "Off Track", icon: AlertCircle, className: "bg-danger-subtle text-danger-primary" },
} satisfies Record<Doc<"projectProfiles">["health"], { label: string; icon: typeof Clock; className: string }>;
const getHealthBadge = (health: Doc<"projectProfiles">["health"]) => {
  const { label, icon: Icon, className } = healthLabels[health];
  return (
    <span className={`${className} inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold`}>
      <Icon className="size-3" />
      {label}
    </span>
  );
};

export function ProjectsPortfolio({ workspaceSlug, allProjects, progress, totalsReady, onCreateProject }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [healthFilter, setHealthFilter] = useState<Doc<"projectProfiles">["health"] | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const projects = useMemo(() => {
    let list = [...allProjects];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.identifier.toLowerCase().includes(q));
    }

    if (healthFilter !== "all") {
      list = list.filter((p) => (p.profile?.health ?? "not_assessed") === healthFilter);
    }

    return list;
  }, [allProjects, searchQuery, healthFilter]);

  const completion = (id: string) =>
    progress[id]?.total ? Math.round((progress[id].completed * 100) / progress[id].total) : 0;
  const onTrackCount = allProjects.filter((p) => (p.profile?.health ?? "not_assessed") === "on_track").length;
  const atRiskCount = allProjects.filter(
    (p) => p.profile?.health === "at_risk" || p.profile?.health === "off_track"
  ).length;
  const avgCompletion =
    allProjects.length > 0
      ? Math.round(allProjects.reduce((acc, p) => acc + completion(p._id), 0) / allProjects.length)
      : 0;

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Projects Portfolio</h1>
          <p className="text-xs font-medium text-secondary">
            Authorized delivery workspaces, health tracking, and operational velocity
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={!onCreateProject}
            onClick={() => onCreateProject?.()}
            className="text-xs shadow-xs flex items-center gap-1.5 rounded-xl bg-accent-primary px-3.5 py-2 font-bold text-white hover:bg-accent-primary/90"
          >
            <Plus className="size-3.5" />
            <span>Create Project</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary">Total Projects</span>
            <div className="bg-blue-500/10 text-blue-600 flex size-8 items-center justify-center rounded-xl">
              <FolderGit2 className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-primary">{allProjects.length}</div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">Active workspaces</div>
          </div>
        </div>

        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary">On Track</span>
            <div className="bg-emerald-500/10 text-emerald-600 flex size-8 items-center justify-center rounded-xl">
              <ShieldCheck className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl text-emerald-600 dark:text-emerald-400 font-bold tracking-tight">
              {onTrackCount}
            </div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">Healthy delivery status</div>
          </div>
        </div>

        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary">At Risk / Delayed</span>
            <div className="bg-amber-500/10 text-amber-600 flex size-8 items-center justify-center rounded-xl">
              <AlertCircle className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl text-amber-600 dark:text-amber-400 font-bold tracking-tight">{atRiskCount}</div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">Need attention</div>
          </div>
        </div>

        <div className="shadow-sm flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-secondary">Avg Completion</span>
            <div className="bg-purple-500/10 text-purple-600 flex size-8 items-center justify-center rounded-xl">
              <TrendingUp className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-primary">
              {totalsReady ? `${avgCompletion}%` : "…"}
            </div>
            <div className="mt-1 text-[11px] font-medium text-tertiary">Across active portfolio</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search projects"
            placeholder="Search projects by name or identifier..."
            className="text-xs placeholder-tertiary shadow-xs focus:border-accent-primary w-full rounded-xl border border-subtle bg-surface-1 py-2 pr-4 pl-9 text-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <Select
            value={healthFilter}
            onValueChange={(value) => {
              const health = projectHealth.members.find((entry) => entry.value === value);
              if (value === "all" || health) setHealthFilter(health?.value ?? "all");
            }}
            className="w-auto min-w-40"
            options={[
              { value: "all", label: "All Health Status" },
              ...projectHealth.members.map(({ value }) => ({ value, label: healthLabels[value].label })),
            ]}
          />

          <div className="shadow-xs flex items-center rounded-xl border border-subtle bg-surface-1 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex size-8 items-center justify-center rounded-lg transition-all ${
                viewMode === "grid" ? "bg-layer-2 font-bold text-accent-primary" : "text-tertiary hover:text-primary"
              }`}
              aria-label="Grid View"
              aria-pressed={viewMode === "grid"}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex size-8 items-center justify-center rounded-lg transition-all ${
                viewMode === "list" ? "bg-layer-2 font-bold text-accent-primary" : "text-tertiary hover:text-primary"
              }`}
              aria-label="List View"
              aria-pressed={viewMode === "list"}
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Project Cards Grid / List */}
      {viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.length > 0 ? (
            projects.map((project) => (
              <Link
                key={project._id}
                href={`/${workspaceSlug}/summon/projects/${project._id}/`}
                className="group shadow-sm hover:border-accent-primary/40 hover:shadow-md flex flex-col justify-between rounded-2xl border border-subtle bg-surface-1 p-5 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="text-xs flex size-10 items-center justify-center rounded-xl bg-accent-primary/10 font-bold text-accent-primary">
                        {project.identifier}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm truncate font-bold text-primary group-hover:text-accent-primary">
                          {project.name}
                        </h3>
                        <span className="text-[11px] text-tertiary">Plane Project</span>
                      </div>
                    </div>
                    {getHealthBadge(project.profile?.health ?? "not_assessed")}
                  </div>
                </div>

                <div className="mt-6 border-t border-subtle pt-4">
                  <div className="text-xs flex items-center justify-between font-medium text-secondary">
                    <span>Completion</span>
                    <span className="font-bold text-primary">{totalsReady ? `${completion(project._id)}%` : "…"}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-layer-2">
                    <div
                      className="h-full rounded-full bg-accent-primary transition-all duration-500"
                      style={{ width: `${totalsReady ? completion(project._id) : 0}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-accent-primary">
                    <span>Open Project Hub</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="text-xs col-span-3 rounded-2xl border border-subtle bg-surface-1 py-12 text-center text-tertiary">
              No projects found matching the selected filters.
            </div>
          )}
        </div>
      ) : (
        <div className="shadow-sm overflow-hidden rounded-2xl border border-subtle bg-surface-1">
          <table className="text-xs w-full text-left">
            <thead>
              <tr className="border-b border-subtle bg-layer-1 text-[11px] font-semibold text-tertiary uppercase">
                <th className="px-5 py-3.5">Identifier</th>
                <th className="px-5 py-3.5">Project Name</th>
                <th className="px-5 py-3.5">Health</th>
                <th className="px-5 py-3.5">Completion</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {projects.length > 0 ? (
                projects.map((project) => (
                  <tr key={project._id} className="group transition-colors hover:bg-layer-1">
                    <td className="px-5 py-3.5 font-bold text-accent-primary">{project.identifier}</td>
                    <td className="px-5 py-3.5 font-semibold text-primary">{project.name}</td>
                    <td className="px-5 py-3.5">{getHealthBadge(project.profile?.health ?? "not_assessed")}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex max-w-[160px] items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-layer-2">
                          <div
                            className="h-full rounded-full bg-accent-primary"
                            style={{ width: `${totalsReady ? `${completion(project._id)}%` : "…"}` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-primary">
                          {totalsReady ? `${completion(project._id)}%` : "…"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/${workspaceSlug}/summon/projects/${project._id}/`}
                        className="inline-flex items-center gap-1 font-semibold text-accent-primary hover:underline"
                      >
                        View <ArrowRight className="size-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-xs py-8 text-center text-tertiary">
                    No projects found matching the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
