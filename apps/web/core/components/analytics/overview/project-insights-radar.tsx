/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Bar, BarChart, BarYAxis, ChartTooltip } from "@plane/propel/charts/bar-chart";
import { RadarArea, RadarAxis, RadarChart, RadarGrid, RadarLabels } from "@plane/propel/charts/radar-chart";
import type { TChartData } from "@plane/types";

type Props = {
  data: TChartData<string, string>[];
  label: string;
};

const COLOR = "var(--chart-1)";
/** A radar needs at least three spokes to enclose an area; fewer projects read better as bars. */
const MIN_RADAR_AXES = 3;

function ProjectInsightsRadar({ data, label }: Props) {
  const rows = data.map((item) => ({ key: String(item.key), name: String(item.name), count: Number(item.count ?? 0) }));

  if (rows.length < MIN_RADAR_AXES) {
    return (
      <BarChart
        data={rows}
        xDataKey="name"
        orientation="horizontal"
        barGap={0.45}
        aspectRatio="3 / 1"
        margin={{ top: 8, right: 16, bottom: 8, left: 120 }}
        className="w-full lg:w-3/5"
      >
        <Bar dataKey="count" fill={COLOR} lineCap={4} />
        <BarYAxis />
        <ChartTooltip showCrosshair={false} rows={(point) => [{ color: COLOR, label, value: String(point.count) }]} />
      </BarChart>
    );
  }

  // Bklit radars plot on a fixed 0–100 scale, so counts are shown relative to the busiest project.
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="mx-auto aspect-square w-full max-w-[380px] lg:w-3/5">
      <RadarChart
        metrics={rows.map((row) => ({ key: row.key, label: row.name }))}
        data={[
          {
            label,
            color: COLOR,
            values: Object.fromEntries(rows.map((row) => [row.key, (row.count / max) * 100])),
          },
        ]}
        margin={56}
      >
        <RadarGrid showLabels={false} />
        <RadarAxis />
        <RadarArea index={0} showPoints />
        <RadarLabels fontSize={11} />
      </RadarChart>
    </div>
  );
}

export default ProjectInsightsRadar;
