/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useTheme } from "next-themes";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Tabs } from "@plane/propel/tabs";
import type { TWorkItemFilterCondition } from "@plane/shared-state";
import type { ICycle } from "@plane/types";
import { Loader } from "@plane/ui";
// assets
import darkAssigneeAsset from "@/app/assets/empty-state/active-cycle/assignee-dark.webp?url";
import lightAssigneeAsset from "@/app/assets/empty-state/active-cycle/assignee-light.webp?url";
import darkLabelAsset from "@/app/assets/empty-state/active-cycle/label-dark.webp?url";
import lightLabelAsset from "@/app/assets/empty-state/active-cycle/label-light.webp?url";
import darkPriorityAsset from "@/app/assets/empty-state/active-cycle/priority-dark.webp?url";
import lightPriorityAsset from "@/app/assets/empty-state/active-cycle/priority-light.webp?url";
// hooks
import useLocalStorage from "@/hooks/use-local-storage";
// store
import type { ActiveCycleIssueDetails } from "@/store/issue/cycle";
// local
import { AssigneesTab, LabelsTab, PriorityIssuesTab, StatsTabTrigger } from "./cycle-stats-tabs";

export type ActiveCycleStatsProps = {
  workspaceSlug: string;
  projectId: string;
  cycle: ICycle | null;
  cycleId?: string | null;
  handleFiltersUpdate: (conditions: TWorkItemFilterCondition[]) => void;
  cycleIssueDetails?: ActiveCycleIssueDetails | { nextPageResults: boolean };
};

export const ActiveCycleStats = observer(function ActiveCycleStats(props: ActiveCycleStatsProps) {
  const { workspaceSlug, projectId, cycle, cycleId, handleFiltersUpdate, cycleIssueDetails } = props;
  // local storage
  const { storedValue: tab, setValue: setTab } = useLocalStorage("activeCycleTab", "Assignees");
  const activeTab = tab || "Priority-Issues";
  // theme hook
  const { resolvedTheme } = useTheme();
  // plane hooks
  const { t } = useTranslation();
  // derived values
  const priorityResolvedPath = resolvedTheme === "light" ? lightPriorityAsset : darkPriorityAsset;
  const assigneesResolvedPath = resolvedTheme === "light" ? lightAssigneeAsset : darkAssigneeAsset;
  const labelsResolvedPath = resolvedTheme === "light" ? lightLabelAsset : darkLabelAsset;

  if (!cycleId)
    return (
      <Loader className="col-span-1 flex min-h-[17rem] flex-col gap-4 overflow-hidden bg-surface-1 lg:col-span-2 xl:col-span-1">
        <Loader.Item width="100%" height="17rem" />
      </Loader>
    );

  return (
    <div className="col-span-1 flex min-h-[17rem] flex-col gap-4 overflow-hidden rounded-lg border border-subtle bg-surface-1 p-4 lg:col-span-2 xl:col-span-1">
      <Tabs value={activeTab} onValueChange={(value) => setTab(String(value))}>
        <Tabs.List
          className="relative grid rounded-sm border-[0.5px] border-subtle bg-layer-1 p-[1px]"
          style={{
            gridTemplateColumns: `repeat(3, 1fr)`,
          }}
        >
          <StatsTabTrigger
            value="Priority-Issues"
            activeTab={tab ?? ""}
            label={t("project_cycles.active_cycle.priority_issue")}
          />
          <StatsTabTrigger value="Assignees" activeTab={tab ?? ""} label={t("project_cycles.active_cycle.assignees")} />
          <StatsTabTrigger value="Labels" activeTab={tab ?? ""} label={t("project_cycles.active_cycle.labels")} />
        </Tabs.List>

        <PriorityIssuesTab
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          cycleId={cycleId}
          cycleIssueDetails={cycleIssueDetails}
          handleFiltersUpdate={handleFiltersUpdate}
          emptyStateAssetPath={priorityResolvedPath}
        />
        <AssigneesTab
          cycle={cycle}
          handleFiltersUpdate={handleFiltersUpdate}
          emptyStateAssetPath={assigneesResolvedPath}
        />
        <LabelsTab cycle={cycle} handleFiltersUpdate={handleFiltersUpdate} emptyStateAssetPath={labelsResolvedPath} />
      </Tabs>
    </div>
  );
});
