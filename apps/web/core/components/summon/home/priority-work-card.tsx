/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowUpRight, Flame } from "lucide-react";
import type { ISummonHomeSummary } from "@plane/types";

interface IPriorityWorkCardProps {
  priorityIssues: ISummonHomeSummary["priority"];
  workspaceSlug: string;
}

export function PriorityWorkCard({ priorityIssues, workspaceSlug }: IPriorityWorkCardProps) {
  return (
    <div className="shadow-sm rounded-2xl border border-subtle bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-red-500/10 text-red-600 dark:text-red-400 flex size-7 items-center justify-center rounded-lg">
            <Flame className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-primary">Priority Work Queue</h2>
            <p className="text-[11px] text-tertiary">Tasks requiring urgent attention or target delivery</p>
          </div>
        </div>
        <Link
          href={`/${workspaceSlug}/workspace-views/all-issues/`}
          className="text-xs font-semibold text-accent-primary hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="mt-4 divide-y divide-subtle">
        {priorityIssues.length > 0 ? (
          priorityIssues.map((issue) => (
            <Link
              key={issue.id}
              href={`/${workspaceSlug}/projects/${issue.project.id}/issues/${issue.id}/`}
              className="group flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-layer-1"
            >
              <div className="flex min-w-0 items-center gap-3">
                {issue.completed ? (
                  <CheckCircle2 className="text-emerald-500 size-4.5 shrink-0" />
                ) : (
                  <Circle className="text-amber-500 size-4.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <h3 className="text-xs truncate font-semibold text-primary group-hover:text-accent-primary">
                    {issue.name}
                  </h3>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-secondary">
                    <span className="rounded-md bg-layer-2 px-1.5 py-0.5 font-medium text-secondary">
                      {issue.project.identifier}
                    </span>
                    <span className="truncate">{issue.project.name}</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-layer-2 px-2 py-0.5 text-[10px] font-semibold text-secondary">
                  {issue.state?.name || "Active"}
                </span>
                <ArrowUpRight className="size-3.5 text-tertiary group-hover:text-accent-primary" />
              </div>
            </Link>
          ))
        ) : (
          <div className="text-xs py-6 text-center text-tertiary">
            No priority blockers or overdue tasks. Keep up the great work!
          </div>
        )}
      </div>
    </div>
  );
}
