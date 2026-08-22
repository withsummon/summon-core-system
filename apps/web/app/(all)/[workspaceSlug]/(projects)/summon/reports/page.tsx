/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import { SummonCard, SummonMetric, SummonScreen } from "@/components/summon/screen";
import { SummonRequestState } from "@/components/summon/request-state";
import { summonService } from "@/services/summon.service";
import type { Route } from "./+types/page";

export default function SummonReportsPage({ params }: Route.ComponentProps) {
  const { data, error, isLoading, mutate } = useSWR(["summon-report", params.workspaceSlug], () =>
    summonService.getReport(params.workspaceSlug)
  );
  if (!data) return <SummonRequestState loading={isLoading} error={error} onRetry={() => void mutate()} />;
  const completion = data.issues.total ? Math.round((data.issues.completed / data.issues.total) * 100) : 0;
  const automationCompletion = data.automation.jobs
    ? Math.round((data.automation.completed / data.automation.jobs) * 100)
    : 0;
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
      title="Management & Reporting"
      description="Computed live from authorized Plane and Summon records; no report totals are persisted twice."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummonMetric label="Projects" value={data.projects} detail="Accessible portfolio" />
        <SummonMetric label="Work items" value={data.issues.total} detail={`${completion}% complete`} />
        <SummonMetric label="Opportunities" value={data.commercial.opportunities} detail="Commercial pipeline" />
        <SummonMetric
          label="Pages & files"
          value={data.knowledge.pages + data.knowledge.files}
          detail="Knowledge assets"
        />
        <SummonMetric label="Overdue" value={data.issues.overdue} detail="Needs attention" />
      </div>
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
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          ["Work-item completion", completion],
          ["Automation completion", automationCompletion],
        ].map(([label, value]) => (
          <SummonCard key={label}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-primary">{label}</h2>
              <span className="text-lg font-semibold text-accent-primary">{value}%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-layer-2">
              <div className="bg-accent-strong h-full rounded-full" style={{ width: `${value}%` }} />
            </div>
          </SummonCard>
        ))}
      </div>
    </SummonScreen>
  );
}
