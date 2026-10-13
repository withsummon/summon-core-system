/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { SyntheticEvent } from "react";
import { useMemo } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { StartDatePropertyIcon, DueDatePropertyIcon } from "@plane/propel/icons";
import type { IIssueDisplayProperties, TIssue } from "@plane/types";
import { getDate, renderFormattedPayloadDate, shouldHighlightIssueDueDate } from "@plane/utils";
// components
import { DateDropdown } from "@/components/dropdowns/date";
import { DateRangeDropdown } from "@/components/dropdowns/date-range";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { PriorityDropdown } from "@/components/dropdowns/priority";
import { StateDropdown } from "@/components/dropdowns/state/dropdown";
// hooks
import { WithDisplayPropertiesHOC } from "@/components/issues/issue-layouts/properties/with-display-properties-HOC";
import { useProjectState } from "@/hooks/store/use-project-state";

type Props = {
  workspaceSlug: string;
  parentIssueId: string;
  issueId: string;
  canEdit: boolean;
  updateSubIssue: (
    workspaceSlug: string,
    projectId: string,
    parentIssueId: string,
    issueId: string,
    issueData: Partial<TIssue>,
    oldIssue?: Partial<TIssue>
  ) => Promise<void>;
  displayProperties?: IIssueDisplayProperties;
  issue: TIssue;
};

type TSubIssueDatePropertiesProps = {
  issue: TIssue;
  displayProperties: IIssueDisplayProperties;
  canEdit: boolean;
  shouldHighlight: boolean;
  onStartDateChange: (date: Date | null) => void;
  onTargetDateChange: (date: Date | null) => void;
};

function SubIssueDateProperties(props: TSubIssueDatePropertiesProps) {
  const { issue, displayProperties, canEdit, shouldHighlight, onStartDateChange, onTargetDateChange } = props;
  const { t } = useTranslation();

  const handleEventPropagation = (e: SyntheticEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
  };

  // date range is enabled only when both dates are available and both dates are enabled
  const isDateRangeEnabled = Boolean(
    issue.start_date && issue.target_date && displayProperties.start_date && displayProperties.due_date
  );
  const startDate = getDate(issue.start_date);
  const targetDate = getDate(issue.target_date);
  const highlightClassName = shouldHighlight ? "text-danger-primary" : "";

  return (
    <>
      {/* merged dates */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey={["start_date", "due_date"]}
        shouldRenderProperty={() => isDateRangeEnabled}
      >
        <div className="h-5" onFocus={handleEventPropagation} onClick={handleEventPropagation}>
          <DateRangeDropdown
            value={{
              from: startDate || undefined,
              to: targetDate || undefined,
            }}
            placement="top-end"
            onSelect={(range) => {
              onStartDateChange(range?.from ?? null);
              onTargetDateChange(range?.to ?? null);
            }}
            hideIcon={{
              from: false,
            }}
            isClearable
            mergeDates
            buttonVariant={issue.start_date || issue.target_date ? "border-with-text" : "border-without-text"}
            buttonClassName={highlightClassName}
            disabled={!canEdit}
            showTooltip
            customTooltipHeading="Date Range"
            renderPlaceholder={false}
            renderInPortal
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* start date */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="start_date"
        shouldRenderProperty={() => !isDateRangeEnabled}
      >
        <div className="h-5">
          <DateDropdown
            value={issue.start_date ?? null}
            onChange={onStartDateChange}
            maxDate={targetDate}
            placeholder={t("common.order_by.start_date")}
            icon={<StartDatePropertyIcon className="h-3 w-3 flex-shrink-0" />}
            buttonVariant={issue.start_date ? "border-with-text" : "border-without-text"}
            optionsClassName="z-30"
            disabled={!canEdit}
            showTooltip
          />
        </div>
      </WithDisplayPropertiesHOC>

      {/* target/due date */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="due_date"
        shouldRenderProperty={() => !isDateRangeEnabled}
      >
        <div className="h-5">
          <DateDropdown
            value={issue.target_date ?? null}
            onChange={onTargetDateChange}
            minDate={startDate}
            placeholder={t("common.order_by.due_date")}
            icon={<DueDatePropertyIcon className="h-3 w-3 flex-shrink-0" />}
            buttonVariant={issue.target_date ? "border-with-text" : "border-without-text"}
            buttonClassName={highlightClassName}
            clearIconClassName="text-primary"
            optionsClassName="z-30"
            disabled={!canEdit}
            showTooltip
          />
        </div>
      </WithDisplayPropertiesHOC>
    </>
  );
}

export const SubIssuesListItemProperties = observer(function SubIssuesListItemProperties(props: Props) {
  const { workspaceSlug, parentIssueId, issueId, canEdit, updateSubIssue, displayProperties, issue } = props;
  const { getStateById } = useProjectState();

  const updateIssue = (issueData: Partial<TIssue>, oldIssue?: Partial<TIssue>) => {
    if (!issue.project_id) return;
    return updateSubIssue(workspaceSlug, issue.project_id, parentIssueId, issueId, issueData, oldIssue);
  };

  const handleStartDate = (date: Date | null) => {
    void updateIssue({ start_date: date ? renderFormattedPayloadDate(date) : null });
  };

  const handleTargetDate = (date: Date | null) => {
    void updateIssue({ target_date: date ? renderFormattedPayloadDate(date) : null });
  };

  const hasAssignees = (issue.assignee_ids?.length ?? 0) > 0;

  //derived values
  const stateDetails = useMemo(() => getStateById(issue.state_id), [getStateById, issue.state_id]);
  const shouldHighlight = useMemo(
    () => shouldHighlightIssueDueDate(issue.target_date, stateDetails?.group),
    [issue.target_date, stateDetails?.group]
  );
  if (!displayProperties) return <></>;

  return (
    <div className="relative flex items-center gap-2">
      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="state">
        <div className="h-5 flex-shrink-0">
          <StateDropdown
            value={issue.state_id}
            projectId={issue.project_id ?? undefined}
            onChange={(val) => updateIssue({ state_id: val }, { ...issue })}
            disabled={!canEdit}
            buttonVariant="transparent-without-text"
            buttonClassName="hover:bg-transparent px-0"
            iconSize="size-5"
            showTooltip
          />
        </div>
      </WithDisplayPropertiesHOC>

      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="priority">
        <div className="h-5 flex-shrink-0">
          <PriorityDropdown
            value={issue.priority}
            onChange={(val) => updateIssue({ priority: val })}
            disabled={!canEdit}
            buttonVariant="border-without-text"
            showTooltip
          />
        </div>
      </WithDisplayPropertiesHOC>

      <SubIssueDateProperties
        issue={issue}
        displayProperties={displayProperties}
        canEdit={canEdit}
        shouldHighlight={shouldHighlight}
        onStartDateChange={handleStartDate}
        onTargetDateChange={handleTargetDate}
      />

      <WithDisplayPropertiesHOC displayProperties={displayProperties} displayPropertyKey="assignee">
        <div className="h-5 flex-shrink-0">
          <MemberDropdown
            value={issue.assignee_ids}
            projectId={issue.project_id ?? undefined}
            onChange={(val) => updateIssue({ assignee_ids: val })}
            disabled={!canEdit}
            multiple
            buttonVariant={hasAssignees ? "transparent-without-text" : "border-without-text"}
            buttonClassName={hasAssignees ? "hover:bg-transparent px-0" : ""}
          />
        </div>
      </WithDisplayPropertiesHOC>
    </div>
  );
});
