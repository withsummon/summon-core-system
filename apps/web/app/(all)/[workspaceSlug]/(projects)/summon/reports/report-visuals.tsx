/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { CalendarDays, ChevronDown, Download, SlidersHorizontal } from "lucide-react";
import type { ISummonClient, ISummonReportFilters } from "@plane/types";
import { SummonField, SummonSelect } from "@/components/summon/forms";
import { percentage, reportLabel, type TReportFilterParam } from "./report-view-model";

export function ReportPanel(props: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`min-w-0 rounded-xl border border-subtle bg-surface-1 shadow-[0_8px_30px_rgba(36,55,99,0.025)] ${props.className ?? ""}`}
    >
      {props.children}
    </section>
  );
}

export function ReportKpi(props: { icon: ReactNode; label: string; value: ReactNode; detail: ReactNode }) {
  return (
    <ReportPanel className="flex min-h-28 items-start gap-3 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent-primary">
        {props.icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-secondary">{props.label}</p>
        <p className="text-xl mt-1.5 truncate font-semibold tracking-tight text-primary">{props.value}</p>
        <div className="mt-1 text-[10px] text-tertiary">{props.detail}</div>
      </div>
    </ReportPanel>
  );
}

export function ReportDonut(props: {
  items: Array<{ label: string; count: number; color: string }>;
  center: ReactNode;
  caption: string;
}) {
  const total = props.items.reduce((sum, item) => sum + item.count, 0);
  let offset = 0;
  return (
    <div className="grid place-items-center">
      <div className="relative size-40">
        <svg className="size-40 -rotate-90" viewBox="0 0 42 42" role="img" aria-label={props.caption}>
          <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--color-layer-2)" strokeWidth="4.5" />
          {props.items.map((item) => {
            const share = percentage(item.count, total);
            const segmentOffset = offset;
            offset += share;
            return (
              <circle
                key={item.label}
                cx="21"
                cy="21"
                r="15.9155"
                fill="none"
                pathLength="100"
                stroke={item.color}
                strokeDasharray={`${share} ${100 - share}`}
                strokeDashoffset={-segmentOffset}
                strokeWidth="4.5"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <strong className="text-2xl font-semibold tracking-tight text-primary">{props.center}</strong>
          <span className="mt-0.5 text-[10px] text-secondary">{props.caption}</span>
        </div>
      </div>
    </div>
  );
}

export function ReportLegend(props: {
  items: Array<{ label: string; count: number | string; detail?: string; color: string }>;
}) {
  return (
    <div className="grid min-w-0 content-center gap-3">
      {props.items.map((item) => (
        <div key={item.label} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-[11px]">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
          <span className="truncate font-medium text-secondary">{item.label}</span>
          <span className="text-right font-semibold text-primary">
            {item.count}
            {item.detail ? <span className="font-normal ml-1 text-tertiary">{item.detail}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PipelineBars(props: { items: Array<{ stage: string; count: number; value: string }>; total: number }) {
  const max = Math.max(1, ...props.items.map((item) => item.count));
  return (
    <div className="space-y-3">
      {props.items.map((item) => (
        <div key={item.stage} className="grid grid-cols-[5rem_minmax(5rem,1fr)_auto] items-center gap-2 text-[10px]">
          <span className="truncate text-secondary">{reportLabel(item.stage)}</span>
          <div className="h-5 overflow-hidden rounded bg-layer-1">
            <div
              className={`h-full rounded ${item.stage === "won" ? "bg-success-primary/20" : item.stage === "lost" ? "bg-danger-primary/15" : "bg-accent-primary/20"}`}
              style={{ width: `${percentage(item.count, max)}%` }}
            />
          </div>
          <span className="font-medium whitespace-nowrap text-primary">
            {item.value} <span className="text-tertiary">({percentage(item.count, props.total)}%)</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function ReportFilters(props: {
  filters: ISummonReportFilters;
  projects: Array<{ id: string; name: string }>;
  clients: ISummonClient[];
  exportUrl: string;
  canExport: boolean;
  onFilterChange: (name: TReportFilterParam, value: string) => void;
}) {
  const { filters, projects, clients, exportUrl, canExport, onFilterChange } = props;
  const controlClass = "focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1";
  const dateLabel =
    filters.dateFrom || filters.dateTo ? `${filters.dateFrom || "Start"} – ${filters.dateTo || "Today"}` : "All dates";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <details className="group relative">
        <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-subtle bg-surface-1 px-3 text-[11px] font-medium text-primary">
          <CalendarDays className="size-3.5 text-secondary" />
          <span>{dateLabel}</span>
          <ChevronDown className="size-3 text-tertiary transition-transform group-open:rotate-180" />
        </summary>
        <div className="shadow-xl absolute right-0 z-30 mt-2 grid w-72 gap-3 rounded-xl border border-subtle bg-surface-1 p-3">
          <SummonField label="From date">
            <input
              id="report-date-from"
              className={`text-xs h-9 w-full rounded-md border border-strong bg-surface-1 px-3 text-primary outline-none ${controlClass}`}
              type="date"
              max={filters.dateTo}
              value={filters.dateFrom ?? ""}
              onChange={(event) => onFilterChange("date_from", event.target.value)}
            />
          </SummonField>
          <SummonField label="To date">
            <input
              id="report-date-to"
              className={`text-xs h-9 w-full rounded-md border border-strong bg-surface-1 px-3 text-primary outline-none ${controlClass}`}
              type="date"
              min={filters.dateFrom}
              value={filters.dateTo ?? ""}
              onChange={(event) => onFilterChange("date_to", event.target.value)}
            />
          </SummonField>
        </div>
      </details>

      <details className="group relative">
        <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-subtle bg-surface-1 px-3 text-[11px] font-medium text-primary">
          <SlidersHorizontal className="size-3.5 text-secondary" /> Filters
          <ChevronDown className="size-3 text-tertiary transition-transform group-open:rotate-180" />
        </summary>
        <div className="shadow-xl absolute right-0 z-30 mt-2 grid w-72 gap-3 rounded-xl border border-subtle bg-surface-1 p-3">
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
        </div>
      </details>

      {canExport ? (
        <a
          href={exportUrl}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent-primary px-4 text-[11px] font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Download className="size-3.5" /> Export Report <ChevronDown className="size-3" />
        </a>
      ) : (
        <button
          type="button"
          disabled
          className="h-9 cursor-not-allowed rounded-lg bg-layer-2 px-4 text-[11px] text-tertiary"
        >
          Export Report
        </button>
      )}
    </div>
  );
}
