/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CalendarDays, Download, SlidersHorizontal } from "lucide-react";
import { getButtonStyling } from "@plane/propel/button";
import { Popover } from "@plane/propel/popover";
import type { ISummonClient, ISummonReportFilters } from "@plane/types";
import { SummonField } from "@/components/summon/forms";
import type { TReportFilterParam } from "./report-view-model";
import { Select } from "@plane/propel/select";
import { DatePicker } from "@plane/propel/date-picker";

const FILTER_PANEL_CLASSNAME =
  "grid w-[min(18rem,calc(100vw-2rem))] gap-3 rounded-xl border border-subtle bg-surface-1 p-3 text-13 text-primary shadow-overlay-100";

export function ReportFilters(props: {
  filters: ISummonReportFilters;
  projects: Array<{ id: string; name: string }>;
  clients: ISummonClient[];
  exportUrl: string;
  onFilterChange: (name: TReportFilterParam, value: string) => void;
}) {
  const { filters, projects, clients, exportUrl, onFilterChange } = props;
  const dateLabel =
    filters.dateFrom || filters.dateTo ? `${filters.dateFrom || "Start"} – ${filters.dateTo || "Today"}` : "All dates";
  const activeFilters = [filters.projectId, filters.clientId].filter(Boolean).length;
  return (
    <>
      <Popover>
        <Popover.Button className={getButtonStyling("secondary", "lg")}>
          <CalendarDays aria-hidden="true" className="size-4 text-secondary" />
          {dateLabel}
        </Popover.Button>
        <Popover.Panel
          placement="bottom-end"
          sideOffset={4}
          positionerClassName="z-[110]"
          className={FILTER_PANEL_CLASSNAME}
        >
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
        </Popover.Panel>
      </Popover>

      <Popover>
        <Popover.Button className={getButtonStyling("secondary", "lg")}>
          <SlidersHorizontal aria-hidden="true" className="size-4 text-secondary" />
          Filters
          {activeFilters ? (
            <span className="rounded-sm bg-accent-subtle px-1.5 text-12 text-accent-primary tabular-nums">
              {activeFilters}
            </span>
          ) : null}
        </Popover.Button>
        <Popover.Panel
          placement="bottom-end"
          sideOffset={4}
          positionerClassName="z-[110]"
          className={FILTER_PANEL_CLASSNAME}
        >
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
        </Popover.Panel>
      </Popover>

      <a href={exportUrl} download className={getButtonStyling("primary", "lg")}>
        <Download aria-hidden="true" className="size-4" />
        Export CSV
      </a>
    </>
  );
}
