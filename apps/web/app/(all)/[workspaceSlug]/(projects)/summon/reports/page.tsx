/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import { SummonCard, SummonScreen } from "@/components/summon/screen";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonReportsPage({ params }: Route.ComponentProps) {
  const { data, error, isLoading, mutate } = useSWR(["summon-report", params.workspaceSlug], () =>
    summonService.getReport(params.workspaceSlug)
  );
  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;
  const sections = [
    {
      title: "Delivery",
      rows: [
        ["Projects", data.projects],
        ["Work items", data.issues.total],
        ["Completed", data.issues.completed],
        ["Overdue", data.issues.overdue],
      ],
    },
    {
      title: "Commercial",
      rows: [
        ["Clients", data.commercial.clients],
        ["Opportunities", data.commercial.opportunities],
        ["Open pipeline", data.commercial.pipeline_value],
      ],
    },
    {
      title: "Knowledge & operations",
      rows: [
        ["Pages", data.knowledge.pages],
        ["Files", data.knowledge.files],
        ["Meetings", data.meetings],
        ["Automation jobs", data.automation.jobs],
      ],
    },
  ];
  return (
    <SummonScreen
      title="Reports"
      description="Computed live from authorized Plane and Summon records; no report totals are persisted twice."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {sections.map((section) => (
          <SummonCard key={section.title}>
            <h2 className="text-sm font-semibold text-primary">{section.title}</h2>
            <dl className="mt-3 space-y-2">
              {section.rows.map(([label, value]) => (
                <div key={label} className="text-sm flex justify-between gap-4">
                  <dt className="text-secondary">{label}</dt>
                  <dd className="font-medium text-primary">{value}</dd>
                </div>
              ))}
            </dl>
          </SummonCard>
        ))}
      </div>
    </SummonScreen>
  );
}
