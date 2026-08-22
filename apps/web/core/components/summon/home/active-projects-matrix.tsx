/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import Link from "next/link";
import { FolderGit2, ArrowUpRight, CheckCircle, AlertCircle, Clock } from "lucide-react";
import type { ISummonHomeSummary } from "@plane/types";

interface IActiveProjectsMatrixProps {
  projects: ISummonHomeSummary["projects"];
  workspaceSlug: string;
}

export function ActiveProjectsMatrix({ projects, workspaceSlug }: IActiveProjectsMatrixProps) {
  const getHealthBadge = (health: string) => {
    const h = health.toLowerCase();
    if (h.includes("good") || h.includes("on_track") || h.includes("excellent")) {
      return (
        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
          <CheckCircle className="size-3" />
          On Track
        </span>
      );
    }
    if (h.includes("risk") || h.includes("attention")) {
      return (
        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
          <AlertCircle className="size-3" />
          At Risk
        </span>
      );
    }
    return (
      <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
        <Clock className="size-3" />
        {health.replaceAll("_", " ")}
      </span>
    );
  };

  return (
    <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 flex size-7 items-center justify-center rounded-lg">
            <FolderGit2 className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-primary">Active Projects Health</h2>
            <p className="text-[11px] text-tertiary">Real-time completion and delivery progress</p>
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
            <Link
              key={project.id}
              href={`/${workspaceSlug}/summon/projects/${project.id}/`}
              className="group hover:border-accent-primary/40 hover:shadow-xs flex flex-col justify-between rounded-xl border border-subtle bg-layer-1 p-3.5 transition-all hover:bg-layer-2"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="tracking-wider text-[10px] font-bold text-secondary uppercase">
                      {project.identifier}
                    </span>
                    <h3 className="text-xs mt-0.5 truncate font-bold text-primary group-hover:text-accent-primary">
                      {project.name}
                    </h3>
                  </div>
                  {getHealthBadge(project.health)}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] font-medium text-secondary">
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
            </Link>
          ))
        ) : (
          <div className="text-xs col-span-2 py-6 text-center text-tertiary">
            No active projects available in this workspace.
          </div>
        )}
      </div>
    </div>
  );
}
