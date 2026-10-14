/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useMemo } from "react";
import { xor } from "lodash-es";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import type { IIssueDisplayProperties, TIssue } from "@plane/types";
// components
import { CycleDropdown } from "@/components/dropdowns/cycle";
import { ModuleDropdown } from "@/components/dropdowns/module/dropdown";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
// local imports
import { PropertySlot } from "./property-slot";
import { WithDisplayPropertiesHOC } from "./with-display-properties-HOC";

type Props = {
  issue: TIssue;
  displayProperties: IIssueDisplayProperties;
  isReadOnly: boolean;
  isMobile: boolean;
};

/** Module and cycle pickers, shown only for projects that have those views enabled. */
export const IssueModuleCycleProperties = observer(function IssueModuleCycleProperties(props: Props) {
  const { issue, displayProperties, isReadOnly, isMobile } = props;
  const { workspaceSlug } = useParams();
  const { getProjectById } = useProject();
  const storeType = useIssueStoreType();
  const {
    issues: { changeModulesInIssue, addCycleToIssue, removeCycleFromIssue },
  } = useIssues(storeType);
  const projectDetails = getProjectById(issue.project_id);

  const issueOperations = useMemo(
    () => ({
      addModulesToIssue: async (moduleIds: string[]) => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await changeModulesInIssue?.(workspaceSlug.toString(), issue.project_id, issue.id, moduleIds, []);
      },
      removeModulesFromIssue: async (moduleIds: string[]) => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await changeModulesInIssue?.(workspaceSlug.toString(), issue.project_id, issue.id, [], moduleIds);
      },
      addIssueToCycle: async (cycleId: string) => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await addCycleToIssue?.(workspaceSlug.toString(), issue.project_id, cycleId, issue.id);
      },
      removeIssueFromCycle: async () => {
        if (!workspaceSlug || !issue.project_id || !issue.id) return;
        await removeCycleFromIssue?.(workspaceSlug.toString(), issue.project_id, issue.id);
      },
    }),
    [workspaceSlug, issue, changeModulesInIssue, addCycleToIssue, removeCycleFromIssue]
  );

  const handleModule = useCallback(
    (moduleIds: string[] | null) => {
      if (!issue || !issue.module_ids || !moduleIds) return;

      const updatedModuleIds = xor(issue.module_ids, moduleIds);
      const modulesToAdd: string[] = [];
      const modulesToRemove: string[] = [];
      const currentModuleIds = new Set(issue.module_ids);
      for (const moduleId of updatedModuleIds)
        if (currentModuleIds.has(moduleId)) modulesToRemove.push(moduleId);
        else modulesToAdd.push(moduleId);
      if (modulesToAdd.length > 0) issueOperations.addModulesToIssue(modulesToAdd);
      if (modulesToRemove.length > 0) issueOperations.removeModulesFromIssue(modulesToRemove);
    },
    [issueOperations, issue]
  );

  const handleCycle = useCallback(
    (cycleId: string | null) => {
      if (!issue || issue.cycle_id === cycleId) return;
      if (cycleId) issueOperations.addIssueToCycle?.(cycleId);
      else issueOperations.removeIssueFromCycle?.();
    },
    [issue, issueOperations]
  );

  return (
    <>
      {/* modules */}
      {projectDetails?.module_view && (
        <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="modules">
          <PropertySlot>
            <ModuleDropdown
              buttonContainerClassName="truncate max-w-40"
              projectId={issue.project_id ?? undefined}
              value={issue?.module_ids ?? []}
              onChange={handleModule}
              disabled={isReadOnly}
              renderByDefault={isMobile}
              multiple
              buttonVariant="border-with-text"
              showCount
              showTooltip
            />
          </PropertySlot>
        </WithDisplayPropertiesHOC>
      )}

      {/* cycles */}
      {projectDetails?.cycle_view && (
        <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="cycle">
          <PropertySlot>
            <CycleDropdown
              buttonContainerClassName="truncate max-w-40"
              projectId={issue.project_id ?? undefined}
              value={issue?.cycle_id}
              onChange={handleCycle}
              disabled={isReadOnly}
              buttonVariant="border-with-text"
              renderByDefault={isMobile}
              showTooltip
            />
          </PropertySlot>
        </WithDisplayPropertiesHOC>
      )}
    </>
  );
});
