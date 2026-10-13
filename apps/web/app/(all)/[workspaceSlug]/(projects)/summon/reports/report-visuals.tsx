/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { CalendarDays, ChevronDown, Download, SlidersHorizontal } from "lucide-react";
import type { ISummonClient, ISummonReportFilters } from "@plane/types";
import { SummonField } from "@/components/summon/forms";
import type { TReportFilterParam } from "./report-view-model";
import { Select } from "@plane/propel/select";
import { DatePicker } from "@plane/propel/date-picker";

export function ReportPanel(props: { children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border border-subtle bg-surface-1 shadow-xs ${props.className ?? ""}`}>
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
        <p className="text-12 font-medium text-secondary">{props.label}</p>
        <p className="mt-1.5 truncate text-xl font-semibold tracking-tight text-primary">{props.value}</p>
        <div className="mt-1 text-12 text-tertiary">{props.detail}</div>
      </div>
    </ReportPanel>
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
  const dateLabel =
    filters.dateFrom || filters.dateTo ? `${filters.dateFrom || "Start"} – ${filters.dateTo || "Today"}` : "All dates";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <details className="group relative">
        <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-subtle bg-surface-1 px-3 text-12 font-medium text-primary">
          <CalendarDays className="size-3.5 text-secondary" />
          <span>{dateLabel}</span>
          <ChevronDown className="size-3 text-tertiary transition-transform group-open:rotate-180" />
        </summary>
        <div className="absolute right-0 z-30 mt-2 grid w-72 gap-3 rounded-xl border border-subtle bg-surface-1 p-3 shadow-xl">
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
        <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-subtle bg-surface-1 px-3 text-12 font-medium text-primary">
          <SlidersHorizontal className="size-3.5 text-secondary" /> Filters
          <ChevronDown className="size-3 text-tertiary transition-transform group-open:rotate-180" />
        </summary>
        <div className="absolute right-0 z-30 mt-2 grid w-72 gap-3 rounded-xl border border-subtle bg-surface-1 p-3 shadow-xl">
          <SummonField label="Project">
            <Select
              value={filters.projectId ?? ""}
              onValueChange={(value) => onFilterChange("project_id", value)}
              options={[
                { value: "", label: "All accessible projects" },
                ...projects.map((project) => ({ value: project.id, label: project.name })),
              ]}
            />
          </SummonField>
          <SummonField label="Client">
            <Select
              value={filters.clientId ?? ""}
              onValueChange={(value) => onFilterChange("client_id", value)}
              options={[
                { value: "", label: "All clients" },
                ...clients.map((client) => ({ value: client.id, label: client.name })),
              ]}
            />
          </SummonField>
        </div>
      </details>

      {canExport ? (
        <a
          href={exportUrl}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent-primary px-4 text-12 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Download className="size-3.5" /> Export Report <ChevronDown className="size-3" />
        </a>
      ) : (
        <button
          type="button"
          disabled
          className="h-9 cursor-not-allowed rounded-lg bg-layer-2 px-4 text-12 text-tertiary"
        >
          Export Report
        </button>
      )}
    </div>
  );
}
