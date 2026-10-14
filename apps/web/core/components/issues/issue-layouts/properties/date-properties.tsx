/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { DueDatePropertyIcon, StartDatePropertyIcon } from "@plane/propel/icons";
import type { IIssueDisplayProperties, TIssue } from "@plane/types";
import { getDate, renderFormattedPayloadDate, shouldHighlightIssueDueDate } from "@plane/utils";
// components
import { DateDropdown } from "@/components/dropdowns/date";
import { DateRangeDropdown } from "@/components/dropdowns/date-range";
// hooks
import { useProjectState } from "@/hooks/store/use-project-state";
// local imports
import { PropertySlot } from "./property-slot";
import { WithDisplayPropertiesHOC } from "./with-display-properties-HOC";

type Props = {
  issue: TIssue;
  displayProperties: IIssueDisplayProperties;
  activeLayout: string;
  isReadOnly: boolean;
  isMobile: boolean;
  updateIssue: ((projectId: string | null, issueId: string, data: Partial<TIssue>) => Promise<void>) | undefined;
};

/** Start and due dates, merged into one range control when both are set and both are displayed. */
export const IssueDateProperties = observer(function IssueDateProperties(props: Props) {
  const { issue, displayProperties, activeLayout, isReadOnly, isMobile, updateIssue } = props;
  const { t } = useTranslation();
  const { getStateById } = useProjectState();

  const stateDetails = getStateById(issue.state_id);
  const isDueDateHighlighted = shouldHighlightIssueDueDate(issue.target_date, stateDetails?.group);

  const handleStartDate = async (date: Date | null) => {
    if (updateIssue)
      await updateIssue(issue.project_id, issue.id, { start_date: date ? renderFormattedPayloadDate(date) : null });
  };

  const handleTargetDate = async (date: Date | null) => {
    if (updateIssue)
      await updateIssue(issue.project_id, issue.id, { target_date: date ? renderFormattedPayloadDate(date) : null });
  };

  // date range is enabled only when both dates are available and both dates are enabled
  const isDateRangeEnabled: boolean = Boolean(
    issue.start_date && issue.target_date && displayProperties.start_date && displayProperties.due_date
  );

  const minDate = getDate(issue.start_date);
  const maxDate = getDate(issue.target_date);

  return (
    <>
      {/* merged dates */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey={["start_date", "due_date"]}
        shouldRenderProperty={() => isDateRangeEnabled}
      >
        <PropertySlot layout={activeLayout} isEmpty={!issue.start_date && !issue.target_date}>
          <DateRangeDropdown
            value={{
              from: minDate || undefined,
              to: maxDate || undefined,
            }}
            onSelect={(range) => {
              handleStartDate(range?.from ?? null);
              handleTargetDate(range?.to ?? null);
            }}
            hideIcon={{
              from: false,
            }}
            isClearable
            mergeDates
            buttonVariant={issue.start_date || issue.target_date ? "border-with-text" : "transparent-without-text"}
            buttonClassName={isDueDateHighlighted ? "text-danger-primary" : ""}
            clearIconClassName="text-primary!"
            disabled={isReadOnly}
            renderByDefault={isMobile}
            showTooltip
            renderPlaceholder={false}
            customTooltipHeading="Date Range"
          />
        </PropertySlot>
      </WithDisplayPropertiesHOC>

      {/* start date */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="start_date"
        shouldRenderProperty={() => !isDateRangeEnabled}
      >
        <PropertySlot layout={activeLayout} isEmpty={!issue.start_date}>
          <DateDropdown
            value={issue.start_date ?? null}
            onChange={handleStartDate}
            maxDate={maxDate}
            placeholder={t("common.order_by.start_date")}
            icon={<StartDatePropertyIcon className="h-3 w-3 flex-shrink-0" />}
            buttonVariant={issue.start_date ? "border-with-text" : "transparent-without-text"}
            optionsClassName="z-10"
            disabled={isReadOnly}
            renderByDefault={isMobile}
            showTooltip
            labelClassName="text-caption-sm-regular"
          />
        </PropertySlot>
      </WithDisplayPropertiesHOC>

      {/* target/due date */}
      <WithDisplayPropertiesHOC
        displayProperties={displayProperties}
        displayPropertyKey="due_date"
        shouldRenderProperty={() => !isDateRangeEnabled}
      >
        <PropertySlot layout={activeLayout} isEmpty={!issue.target_date}>
          <DateDropdown
            value={issue?.target_date ?? null}
            onChange={handleTargetDate}
            minDate={minDate}
            placeholder={t("common.order_by.due_date")}
            icon={<DueDatePropertyIcon className="h-3 w-3 shrink-0" />}
            buttonVariant={issue.target_date ? "border-with-text" : "transparent-without-text"}
            buttonClassName={isDueDateHighlighted ? "text-danger-primary" : ""}
            clearIconClassName="text-primary!"
            optionsClassName="z-10"
            disabled={isReadOnly}
            renderByDefault={isMobile}
            showTooltip
            labelClassName="text-caption-sm-regular"
          />
        </PropertySlot>
      </WithDisplayPropertiesHOC>
    </>
  );
});
