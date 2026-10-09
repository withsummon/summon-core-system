/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { CalendarDays, ChevronDown, Download, SlidersHorizontal } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { readReportFilters } from "./report-view-model";
import { SummonField } from "@/components/summon/forms";
import { percentage, reportLabel, type TReportFilterParam } from "./report-view-model";
import { Select } from "@plane/propel/select";
import { DatePicker } from "@plane/propel/date-picker";

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
  filters: ReturnType<typeof readReportFilters>;
  projects: FunctionReturnType<typeof api.projects.index.list>;
  clients: FunctionReturnType<typeof api.commercial.clients.list>["page"];
  onExport: () => void;
  canExport: boolean;
  onFilterChange: (name: TReportFilterParam, value: string) => void;
}) {
  const { filters, projects, clients, onExport, canExport, onFilterChange } = props;
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
            <DatePicker
              id="report-date-from"
              max={filters.dateTo}
              value={filters.dateFrom ?? ""}
              onValueChange={(value) => onFilterChange("date_from", value)}
            />
          </SummonField>
          <SummonField label="To date">
            <DatePicker
              id="report-date-to"
              min={filters.dateFrom}
              value={filters.dateTo ?? ""}
              onValueChange={(value) => onFilterChange("date_to", value)}
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
            <Select
              value={filters.projectId ?? ""}
              onValueChange={(value) => onFilterChange("project_id", value)}
              options={[
                { value: "", label: "All accessible projects" },
                ...projects.map((project) => ({ value: project._id, label: project.name })),
              ]}
            />
          </SummonField>
          <SummonField label="Client">
            <Select
              value={filters.clientId ?? ""}
              onValueChange={(value) => onFilterChange("client_id", value)}
              options={[
                { value: "", label: "All clients" },
                ...clients.map((client) => ({ value: client._id, label: client.name })),
              ]}
            />
          </SummonField>
        </div>
      </details>

      {canExport ? (
        <button
          type="button"
          onClick={onExport}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent-primary px-4 text-[11px] font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Download className="size-3.5" /> Export Report <ChevronDown className="size-3" />
        </button>
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
