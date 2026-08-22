/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ISummonClient, ISummonReportFilters } from "@plane/types";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { SummonProgressBar } from "@/components/summon/progress";
import { SummonCard } from "@/components/summon/screen";
import { percentage, reportLabel, trendPolylinePoints, type TReportFilterParam } from "./report-view-model";

export function StatusBars({ label, items }: { label: string; items: Array<{ label: string; count: number }> }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="mt-3 space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
            <span className="font-medium text-secondary">{reportLabel(item.label)}</span>
            <span className="font-semibold text-primary">{item.count}</span>
          </div>
          <SummonProgressBar value={percentage(item.count, total)} label={`${label}: ${reportLabel(item.label)}`} />
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ label, points }: { label: string; points: Array<{ date: string; value: number }> }) {
  const polyline = trendPolylinePoints(points.map(({ value }) => value));
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const labelId = `${label.toLowerCase().replaceAll(" ", "-")}-trend-title`;
  return (
    <figure className="mt-3">
      <div className="flex items-end justify-between gap-3">
        <p id={labelId} className="text-[11px] font-medium text-secondary">
          {label}
        </p>
        <p className="text-lg font-semibold text-primary">{total}</p>
      </div>
      <svg className="mt-3 h-24 w-full" viewBox="0 0 320 80" role="img" aria-labelledby={labelId}>
        <line x1="0" y1="79" x2="320" y2="79" className="stroke-border-subtle" />
        <line x1="0" y1="40" x2="320" y2="40" className="stroke-border-subtle" strokeDasharray="4 5" />
        {polyline ? (
          <polyline
            points={polyline}
            fill="none"
            stroke="var(--color-accent-primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <text x="160" y="44" textAnchor="middle" className="fill-tertiary text-[11px]">
            No activity in this period
          </text>
        )}
      </svg>
      <figcaption className="flex justify-between gap-3 text-[10px] text-tertiary">
        <span>{points[0]?.date.slice(0, 10) ?? "No start date"}</span>
        <span>{points.at(-1)?.date.slice(0, 10) ?? "No end date"}</span>
      </figcaption>
    </figure>
  );
}

export function ReportFilters(props: {
  filters: ISummonReportFilters;
  projects: Array<{ id: string; name: string }>;
  clients: ISummonClient[];
  onFilterChange: (name: TReportFilterParam, value: string) => void;
}) {
  const { filters, projects, clients, onFilterChange } = props;
  const controlClass = "focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1";
  return (
    <SummonCard>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummonField label="Project">
          <SummonSelect
            className={controlClass}
            value={filters.projectId ?? ""}
            onChange={(event) => onFilterChange("project_id", event.target.value)}
          >
            <option value="">All accessible projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </SummonSelect>
        </SummonField>
        <SummonField label="Client">
          <SummonSelect
            className={controlClass}
            value={filters.clientId ?? ""}
            onChange={(event) => onFilterChange("client_id", event.target.value)}
          >
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </SummonSelect>
        </SummonField>
        <SummonField label="From date">
          <input
            className={`text-sm h-9 rounded-md border border-strong bg-surface-1 px-3 text-primary outline-none ${controlClass}`}
            type="date"
            max={filters.dateTo}
            value={filters.dateFrom ?? ""}
            onChange={(event) => onFilterChange("date_from", event.target.value)}
          />
        </SummonField>
        <SummonField label="To date">
          <input
            className={`text-sm h-9 rounded-md border border-strong bg-surface-1 px-3 text-primary outline-none ${controlClass}`}
            type="date"
            min={filters.dateFrom}
            value={filters.dateTo ?? ""}
            onChange={(event) => onFilterChange("date_to", event.target.value)}
          />
        </SummonField>
      </div>
    </SummonCard>
  );
}
