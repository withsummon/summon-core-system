/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { MoreVerticalIcon } from "lucide-react";
import { Popover } from "@plane/propel/popover";
// hooks
// ui
// icons
import type { TSupportedFilterTypeForUpdate } from "@plane/constants";
import { EIssueFilterType } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { CheckIcon, ChevronUpIcon } from "@plane/propel/icons";
import type { TCalendarLayouts, TSupportedFilterForUpdate } from "@plane/types";
import { ToggleSwitch } from "@plane/ui";
// types
// constants
import { CALENDAR_LAYOUTS } from "@plane/constants";
import { useCalendarView } from "@/hooks/store/use-calendar-view";
import useSize from "@/hooks/use-window-size";
import type { ICycleIssuesFilter } from "@/store/issue/cycle";
import type { IModuleIssuesFilter } from "@/store/issue/module";
import type { IProjectIssuesFilter } from "@/store/issue/project";
import type { IProjectViewIssuesFilter } from "@/store/issue/project-views";

interface ICalendarHeader {
  issuesFilterStore: IProjectIssuesFilter | IModuleIssuesFilter | ICycleIssuesFilter | IProjectViewIssuesFilter;
  updateFilters?: (
    projectId: string,
    filterType: TSupportedFilterTypeForUpdate,
    filters: TSupportedFilterForUpdate
  ) => Promise<void>;
}

export const CalendarOptionsDropdown = observer(function CalendarOptionsDropdown(props: ICalendarHeader) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const closePopover = () => setPopoverOpen(false);

  const { issuesFilterStore, updateFilters } = props;

  const { t } = useTranslation();

  const { projectId } = useParams();

  const issueCalendarView = useCalendarView();
  const [windowWidth] = useSize();

  const calendarLayout = issuesFilterStore.issueFilters?.displayFilters?.calendar?.layout ?? "month";
  const showWeekends = issuesFilterStore.issueFilters?.displayFilters?.calendar?.show_weekends ?? false;

  const handleLayoutChange = (layout: TCalendarLayouts) => {
    if (!updateFilters) return;

    updateFilters(projectId?.toString(), EIssueFilterType.DISPLAY_FILTERS, {
      calendar: {
        ...issuesFilterStore.issueFilters?.displayFilters?.calendar,
        layout,
      },
    });

    issueCalendarView.updateCalendarPayload(
      layout === "month"
        ? issueCalendarView.calendarFilters.activeMonthDate
        : issueCalendarView.calendarFilters.activeWeekDate
    );
    if (windowWidth <= 768) closePopover(); // close the popover on mobile
  };

  const handleToggleWeekends = () => {
    const showWeekends = issuesFilterStore.issueFilters?.displayFilters?.calendar?.show_weekends ?? false;

    if (!updateFilters) return;

    updateFilters(projectId?.toString(), EIssueFilterType.DISPLAY_FILTERS, {
      calendar: {
        ...issuesFilterStore.issueFilters?.displayFilters?.calendar,
        show_weekends: !showWeekends,
      },
    });
  };

  return (
    <div className="relative flex items-center">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Popover.Button
          render={
            <button type="button">
              <div
                className={`hidden items-center gap-1.5 rounded-sm bg-layer-1 px-2.5 py-1 text-11 outline-none hover:bg-layer-1 md:flex ${
                  popoverOpen ? "text-primary" : "text-secondary"
                }`}
              >
                <div className="font-medium">{t("common.options")}</div>
                <div
                  className={`flex h-3.5 w-3.5 items-center justify-center transition-all ${popoverOpen ? "" : "rotate-180"}`}
                >
                  <ChevronUpIcon width={12} strokeWidth={2} />
                </div>
              </div>
              <div className="md:hidden">
                <MoreVerticalIcon className="h-4 text-secondary" strokeWidth={2} />
              </div>
            </button>
          }
        />
        <Popover.Panel className="z-50" positionerClassName="z-50" placement="bottom-end">
          <div className="min-w-[12rem] overflow-hidden rounded-sm border border-subtle bg-surface-1 p-1 shadow-raised-200">
            <div>
              {Object.entries(CALENDAR_LAYOUTS).map(([layout, layoutDetails]) => (
                <button
                  key={layout}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-sm px-1 py-1.5 text-left text-11 hover:bg-layer-1"
                  onClick={() => handleLayoutChange(layoutDetails.key)}
                >
                  {layoutDetails.title}
                  {calendarLayout === layout && <CheckIcon width={12} height={12} strokeWidth={2} />}
                </button>
              ))}
              <label className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-sm px-1 py-1.5 text-left text-11 hover:bg-layer-1">
                {t("common.actions.show_weekends")}
                <ToggleSwitch
                  value={showWeekends}
                  label={t("common.actions.show_weekends")}
                  onChange={() => {
                    handleToggleWeekends();
                    if (windowWidth <= 768) closePopover(); // close the popover on mobile
                  }}
                />
              </label>
            </div>
          </div>
        </Popover.Panel>
      </Popover>
    </div>
  );
});
