/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle, Clock, FolderGit2 } from "lucide-react";
import type { ISummonHomeSummary } from "@plane/types";
import { capitalizeFirstLetter, replaceUnderscoreIfSnakeCase } from "@plane/utils";
import { projectHealthTone } from "@/components/summon/projects/project-workspace";

interface IActiveProjectsMatrixProps {
  projects: ISummonHomeSummary["projects"];
  workspaceSlug: string;
  onSelect: (projectId: string) => void;
}

const getHealthBadge = (health: string) => {
  const normalizedHealth = health.toLowerCase();
  if (
    normalizedHealth.includes("good") ||
    normalizedHealth.includes("on_track") ||
    normalizedHealth.includes("excellent")
  ) {
    return (
      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-12 font-semibold">
        <CheckCircle className="size-3" />
        On Track
      </span>
    );
  }
  if (normalizedHealth.includes("risk") || normalizedHealth.includes("attention")) {
    return (
      <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-12 font-semibold">
        <AlertCircle className="size-3" />
        At Risk
      </span>
    );
  }
  const tone = projectHealthTone(health);
  return (
    <span
      className={`${tone === "neutral" ? "bg-slate-500/10 text-slate-600 dark:text-slate-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"} inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-12 font-semibold`}
    >
      <Clock className="size-3" />
      {capitalizeFirstLetter(replaceUnderscoreIfSnakeCase(health))}
    </span>
  );
};

export function ActiveProjectsMatrix({ projects, workspaceSlug, onSelect }: IActiveProjectsMatrixProps) {
  return (
    <div className="rounded-2xl border border-subtle bg-surface-1 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 flex size-7 items-center justify-center rounded-lg">
            <FolderGit2 className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-primary">Active Projects Health</h2>
            <p className="text-12 text-tertiary">Real-time completion and delivery progress</p>
          </div>
        </div>
        <Link
          href={`/${workspaceSlug}/summon/projects/`}
          className="text-xs font-semibold text-accent-primary hover:underline"
        >
          View all projects →
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {projects.length > 0 ? (
          projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelect(project.id)}
              className="group hover:border-accent-primary/40 flex flex-col justify-between rounded-xl border border-subtle bg-layer-1 p-3.5 transition-all hover:bg-layer-2 hover:shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-12 font-medium text-tertiary">{project.identifier}</span>
                    <h3 className="mt-0.5 truncate text-xs font-bold text-primary group-hover:text-accent-primary">
                      {project.name}
                    </h3>
                  </div>
                  {getHealthBadge(project.health)}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-12 font-medium text-secondary">
                  <span>Progress</span>
                  <span className="font-bold text-primary">{project.completion}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-layer-2">
                  <div
                    className="h-full rounded-full bg-accent-primary transition-all duration-500"
                    style={{ width: `${Math.max(4, project.completion)}%` }}
                  />
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="col-span-2 py-6 text-center text-xs text-tertiary">
            No active projects available in this workspace.
          </div>
        )}
      </div>
    </div>
  );
}
