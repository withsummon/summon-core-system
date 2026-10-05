/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { SlidersHorizontal } from "lucide-react";
import { CalendarLayoutIcon } from "@plane/propel/icons";
import { SelectXAxis } from "./select-x-axis";
import { SelectYAxis } from "./select-y-axis";
export const analyticsAxes = {
  stateId: "State",
  status: "State group",
  priority: "Priority",
  labelId: "Labels",
  assigneeId: "Assignees",
  estimatePointId: "Estimate points",
  cycleId: "Cycles",
  moduleId: "Modules",
  completedAt: "Completed date",
  targetDate: "Due date",
  startDate: "Start date",
  createdAt: "Created date",
} satisfies Record<FunctionArgs<typeof api.reporting.analytics.chart>["axis"], string>;
export function AnalyticsSelectParams({
  axis,
  groupBy,
  onAxis,
  onGroup,
}: {
  axis: FunctionArgs<typeof api.reporting.analytics.chart>["axis"];
  groupBy: FunctionArgs<typeof api.reporting.analytics.chart>["groupBy"];
  onAxis: (axis: FunctionArgs<typeof api.reporting.analytics.chart>["axis"]) => void;
  onGroup: (group: FunctionArgs<typeof api.reporting.analytics.chart>["groupBy"]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SelectYAxis />
      <SelectXAxis
        value={axis}
        onChange={(value) => {
          if (value !== null) onAxis(value);
        }}
        excluded={groupBy}
        label={
          <span className="flex items-center gap-2">
            <CalendarLayoutIcon className="size-3" />
            {analyticsAxes[axis]}
          </span>
        }
      />
      <SelectXAxis
        value={groupBy}
        onChange={onGroup}
        excluded={axis}
        allowNoValue
        label={
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="size-3" />
            {groupBy ? analyticsAxes[groupBy] : "Group by"}
          </span>
        }
      />
    </div>
  );
}
