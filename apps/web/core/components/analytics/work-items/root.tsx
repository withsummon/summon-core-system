/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback } from "react";
import AnalyticsWrapper, {
  AnalyticsError,
  readTasks,
  useAnalyticsReport,
  type AnalyticsScope,
} from "../analytics-wrapper";
import TotalInsights from "../total-insights";
import CreatedVsResolved from "./created-vs-resolved";
import CustomizedInsights from "./customized-insights";
import WorkItemsInsightTable from "./workitems-insight-table";
export function WorkItems({
  scope,
  generation,
  workspaceSlug,
  peekView = false,
}: {
  scope: AnalyticsScope;
  generation: number;
  workspaceSlug: string;
  peekView?: boolean;
}) {
  const read = useCallback(
    (client: Parameters<typeof readTasks>[0], signal: AbortSignal) => readTasks(client, scope, signal),
    [scope]
  );
  const report = useAnalyticsReport(read, generation);
  return (
    <AnalyticsWrapper i18nTitle="sidebar.work_items">
      <div className="flex flex-col gap-14">
        <AnalyticsError error={report.error} />
        {!report.error && (
          <>
            <TotalInsights counts={report.data?.counts} isLoading={report.isLoading} peekView={peekView} />
          </>
        )}
        <CreatedVsResolved scope={scope} generation={generation} />
        <CustomizedInsights generation={generation} scope={scope} workspaceSlug={workspaceSlug} peekView={peekView} />
        {!report.error && (
          <WorkItemsInsightTable
            data={report.data}
            isLoading={report.isLoading}
            workspaceSlug={workspaceSlug}
            focus={scope.focus !== null}
          />
        )}
      </div>
    </AnalyticsWrapper>
  );
}
