/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// i18n
import { useTranslation } from "@plane/i18n";
import type { TIssue, IIssueDisplayProperties, TIssuePriorities } from "@plane/types";
// ui
import { cn } from "@plane/utils";
// components
import { EstimateDropdown } from "@/components/dropdowns/estimate";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { StateDropdown } from "@/components/dropdowns/state/dropdown";
// hooks
import { useProjectEstimates } from "@/hooks/store/estimates";
import { useLabel } from "@/hooks/store/use-label";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local components
import { IssueCountProperties } from "./count-properties";
import { IssueDateProperties } from "./date-properties";
import { IssuePropertyLabels } from "./labels";
import { IssueModuleCycleProperties } from "./module-cycle-properties";
import { emptySlotClassName } from "./empty-slot";
import { PropertySlot } from "./property-slot";
import { WithDisplayPropertiesHOC } from "./with-display-properties-HOC";

export interface IIssueProperties {
  issue: TIssue;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
  displayProperties: IIssueDisplayProperties | undefined;
  isReadOnly: boolean;
  className: string;
  activeLayout: string;
  isEpic?: boolean;
}

export const IssueProperties = observer(function IssueProperties(props: IIssueProperties) {
  const { issue, updateIssue, displayProperties, activeLayout, isReadOnly, className, isEpic = false } = props;
  // i18n
  const { t } = useTranslation();
  // store hooks
  const { labelMap } = useLabel();
  const { areEstimateEnabledByProjectId } = useProjectEstimates();
  const { isMobile } = usePlatformOS();

  // router
  const { projectId } = useParams();

  // derived values

  const handleState = async (stateId: string) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { state_id: stateId });
  };

  const handlePriority = async (value: TIssuePriorities) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { priority: value });
  };

  const handleLabel = async (ids: string[]) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { label_ids: ids });
  };

  const handleAssignee = async (ids: string[]) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { assignee_ids: ids });
  };

  const handleEstimate = async (value: string | undefined) => {
    if (updateIssue) await updateIssue(issue.project_id, issue.id, { estimate_point: value });
  };

  if (!displayProperties || !issue.project_id) return null;

  const defaultLabelOptions =
    issue?.label_ids?.flatMap((id) => {
      const label = labelMap[id];
      return label ? [label] : [];
    }) || [];

  return (
    <div className={className}>
      {/* basic properties */}
      {/* state */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="state">
        <PropertySlot>
          <StateDropdown
            buttonContainerClassName="truncate max-w-40"
            value={issue.state_id}
            onChange={handleState}
            projectId={issue.project_id}
            disabled={isReadOnly}
            buttonVariant="border-with-text"
            renderByDefault={isMobile}
            showTooltip
          />
        </PropertySlot>
      </WithDisplayPropertiesHOC>

      {/* priority */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="priority">
        <PropertySlot layout={activeLayout} isEmpty={!issue?.priority || issue.priority === "none"}>
          <PriorityDropdown
            value={issue?.priority}
            onChange={handlePriority}
            disabled={isReadOnly}
            buttonVariant={
              !issue?.priority || issue.priority === "none" ? "transparent-without-text" : "border-without-text"
            }
            renderByDefault={isMobile}
            showTooltip
          />
        </PropertySlot>
      </WithDisplayPropertiesHOC>

      <IssueDateProperties
        issue={issue}
        displayProperties={displayProperties}
        activeLayout={activeLayout}
        isReadOnly={isReadOnly}
        isMobile={isMobile}
        updateIssue={updateIssue}
      />

      {/* assignee */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="assignee">
        <PropertySlot layout={activeLayout} isEmpty={!issue.assignee_ids?.length}>
          <MemberDropdown
            projectId={issue?.project_id}
            value={issue?.assignee_ids}
            onChange={handleAssignee}
            disabled={isReadOnly}
            multiple
            buttonVariant="transparent-without-text"
            buttonClassName={issue.assignee_ids?.length > 0 ? "hover:bg-transparent px-0" : ""}
            showTooltip={issue?.assignee_ids?.length === 0}
            placeholder={t("common.assignees")}
            optionsClassName="z-10"
            tooltipContent=""
            renderByDefault={isMobile}
          />
        </PropertySlot>
      </WithDisplayPropertiesHOC>

      {!isEpic && (
        <IssueModuleCycleProperties
          issue={issue}
          displayProperties={displayProperties}
          isReadOnly={isReadOnly}
          isMobile={isMobile}
        />
      )}

      {/* estimates */}
      {projectId && areEstimateEnabledByProjectId(projectId?.toString()) && (
        <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="estimate">
          <PropertySlot>
            <EstimateDropdown
              value={issue.estimate_point ?? undefined}
              onChange={handleEstimate}
              projectId={issue.project_id}
              disabled={isReadOnly}
              buttonVariant="border-with-text"
              renderByDefault={isMobile}
              showTooltip
            />
          </PropertySlot>
        </WithDisplayPropertiesHOC>
      )}

      {/* extra render properties */}
      <IssueCountProperties issue={issue} displayProperties={displayProperties} isMobile={isMobile} isEpic={isEpic} />

      {/* label */}
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="labels">
        <div className={cn("flex", !issue?.label_ids?.length && emptySlotClassName(activeLayout))}>
          <IssuePropertyLabels
            projectId={issue?.project_id || null}
            value={issue?.label_ids || []}
            defaultOptions={defaultLabelOptions}
            onChange={handleLabel}
            disabled={isReadOnly}
            renderByDefault={isMobile}
            hideDropdownArrow
            maxRender={3}
          />
        </div>
      </WithDisplayPropertiesHOC>
    </div>
  );
});
