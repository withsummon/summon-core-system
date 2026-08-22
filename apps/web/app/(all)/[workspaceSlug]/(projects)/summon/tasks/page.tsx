/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import Link from "next/link";
import useSWR from "swr";
import { SummonCard, SummonScreen } from "@/components/summon/screen";
import { SummonRequestState } from "@/components/summon/request-state";
import { listAccessiblePlaneIssues } from "@/services/summon-plane.service";
import type { Route } from "./+types/page";

type TTaskGroup = "Overdue" | "Today" | "Upcoming";

function taskGroup(targetDate: string | undefined | null): TTaskGroup {
  const today = new Date().toISOString().slice(0, 10);
  if (!targetDate || targetDate > today) return "Upcoming";
  return targetDate === today ? "Today" : "Overdue";
}

export default function SummonTasksPage({ params }: Route.ComponentProps) {
  const { data, error, isLoading, mutate } = useSWR(["summon-plane-issues", params.workspaceSlug], () =>
    listAccessiblePlaneIssues(params.workspaceSlug)
  );

  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  return (
    <SummonScreen title="Task Center" description="Read the accessible Plane work queue; update every task in Plane.">
      <SummonRequestState empty={data.length === 0} emptyMessage="No accessible Plane tasks yet." />
      <div className="grid gap-4 lg:grid-cols-3">
        {(["Overdue", "Today", "Upcoming"] as const).map((group) => {
          const issues = data.filter((issue) => taskGroup(issue.target_date) === group);
          return (
            <SummonCard key={group}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-primary">{group}</h2>
                <span className="text-xs text-secondary">{issues.length}</span>
              </div>
              <div className="space-y-2">
                {issues.map((issue) =>
                  issue.project_id ? (
                    <Link
                      key={issue.id}
                      href={`/${params.workspaceSlug}/projects/${issue.project_id}/issues/${issue.id}/`}
                      className="focus-visible:outline-accent-primary block rounded-xl border border-subtle p-3 hover:bg-layer-1 focus-visible:outline focus-visible:outline-2"
                    >
                      <p className="text-xs font-medium text-primary">{issue.name}</p>
                      <p className="mt-1 text-[10px] text-secondary">{issue.target_date ?? "No due date"}</p>
                    </Link>
                  ) : null
                )}
                {!issues.length ? <p className="text-xs py-3 text-center text-tertiary">No tasks.</p> : null}
              </div>
            </SummonCard>
          );
        })}
      </div>
    </SummonScreen>
  );
}
