/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { FunctionArgs } from "convex/server";
import { api } from "@summon/convex/api";
import { useTranslation } from "@plane/i18n";
import AnalyticsSectionWrapper from "../analytics-section-wrapper";
import type { AnalyticsScope } from "../analytics-wrapper";
import { AnalyticsSelectParams } from "../select/analytics-params";
import PriorityChart from "./priority-chart";
export default function CustomizedInsights({
  scope,
  generation,
  workspaceSlug,
  peekView,
}: {
  scope: AnalyticsScope;
  generation: number;
  workspaceSlug: string;
  peekView: boolean;
}) {
  const { t } = useTranslation();
  const [axis, setAxis] = useState<FunctionArgs<typeof api.reporting.analytics.chart>["axis"]>("priority");
  const [groupBy, setGroupBy] = useState<FunctionArgs<typeof api.reporting.analytics.chart>["groupBy"]>(null);
  return (
    <AnalyticsSectionWrapper
      title={t("workspace_analytics.customized_insights")}
      headerClassName={peekView ? "flex-col items-start" : ""}
      actions={<AnalyticsSelectParams axis={axis} groupBy={groupBy} onAxis={setAxis} onGroup={setGroupBy} />}
    >
      <PriorityChart
        key={`${axis}:${groupBy}`}
        scope={scope}
        generation={generation}
        axis={axis}
        groupBy={groupBy}
        workspaceSlug={workspaceSlug}
      />
    </AnalyticsSectionWrapper>
  );
}
