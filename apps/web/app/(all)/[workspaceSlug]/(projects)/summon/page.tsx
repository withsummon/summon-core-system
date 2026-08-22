/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import { Link } from "react-router";
import { summonService } from "@/services/summon.service";
import { SummonCard, SummonScreen } from "@/components/summon/screen";
import { SummonRequestState } from "@/components/summon/request-state";
import type { Route } from "./+types/page";

export default function SummonOverviewPage({ params }: Route.ComponentProps) {
  const { workspaceSlug } = params;
  const { data, error, isLoading, mutate } = useSWR(["summon-report", workspaceSlug], () =>
    summonService.getReport(workspaceSlug)
  );
  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;

  const stats = [
    ["Projects", data.projects],
    ["Work items", data.issues.total],
    ["Overdue", data.issues.overdue],
    ["Clients", data.commercial.clients],
    ["Opportunities", data.commercial.opportunities],
    ["Meetings", data.meetings],
  ];
  return (
    <SummonScreen
      title="Overview"
      description="One operational view over Plane projects, work items, pages, files, and Summon commercial records."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map(([label, value]) => (
          <SummonCard key={label}>
            <p className="text-xs text-secondary">{label}</p>
            <p className="text-2xl mt-2 font-semibold text-primary">{value}</p>
          </SummonCard>
        ))}
      </div>
      <SummonCard>
        <h2 className="text-sm font-semibold text-primary">Canonical ownership</h2>
        <p className="text-sm mt-2 text-secondary">
          Tasks, assignees, status, due dates, knowledge, documents, and notifications stay in Plane. Summon only adds
          the commercial and operational context Plane does not own.
        </p>
        <div className="text-xs mt-3 flex flex-wrap gap-2">
          <Link
            className="rounded bg-layer-2 px-3 py-2 text-primary"
            to={`/${workspaceSlug}/workspace-views/all-issues`}
          >
            Open Tasks
          </Link>
          <Link className="rounded bg-layer-2 px-3 py-2 text-primary" to={`/${workspaceSlug}/notifications`}>
            Open Notifications
          </Link>
        </div>
      </SummonCard>
    </SummonScreen>
  );
}
