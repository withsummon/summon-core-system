/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { isEmpty } from "lodash-es";
import { observer } from "mobx-react";
import type {
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  ILayoutDisplayFiltersOptions,
  TIssueGroupByOptions,
} from "@plane/types";
// components
import {
  FilterDisplayProperties,
  FilterExtraOptions,
  FilterGroupBy,
  FilterOrderBy,
  FilterSubGroupBy,
} from "@/components/issues/issue-layouts/filters";

type Props = {
  displayFilters: IIssueDisplayFilterOptions | undefined;
  displayProperties: IIssueDisplayProperties;
  handleDisplayFiltersUpdate: (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => void;
  handleDisplayPropertiesUpdate: (updatedDisplayProperties: Partial<IIssueDisplayProperties>) => void;
  layoutDisplayFiltersOptions: ILayoutDisplayFiltersOptions | undefined;
  ignoreGroupedFilters?: Partial<TIssueGroupByOptions>[];
  cycleViewDisabled?: boolean;
  moduleViewDisabled?: boolean;
  isEpic?: boolean;
};

const getVisibleSections = (
  layoutDisplayFiltersOptions: ILayoutDisplayFiltersOptions | undefined,
  displayFilters: IIssueDisplayFilterOptions | undefined
) => {
  const enabledDisplayFilters = new Set(Object.keys(layoutDisplayFiltersOptions?.display_filters ?? {}));
  return {
    displayProperties: (layoutDisplayFiltersOptions?.display_properties?.length ?? 0) > 0,
    groupBy: enabledDisplayFilters.has("group_by"),
    subGroupBy:
      enabledDisplayFilters.has("sub_group_by") &&
      displayFilters?.group_by !== null &&
      displayFilters?.layout === "kanban",
    orderBy: enabledDisplayFilters.has("order_by") && !isEmpty(layoutDisplayFiltersOptions?.display_filters?.order_by),
    extraOptions: Boolean(layoutDisplayFiltersOptions?.extra_options.access),
    groupByOptions: layoutDisplayFiltersOptions?.display_filters.group_by ?? [],
    subGroupByOptions: layoutDisplayFiltersOptions?.display_filters.sub_group_by ?? [],
    orderByOptions: layoutDisplayFiltersOptions?.display_filters.order_by ?? [],
  };
};

export const DisplayFiltersSelection = observer(function DisplayFiltersSelection(props: Props) {
  const {
    displayFilters,
    displayProperties,
    handleDisplayFiltersUpdate,
    handleDisplayPropertiesUpdate,
    layoutDisplayFiltersOptions,
    ignoreGroupedFilters = [],
    cycleViewDisabled = false,
    moduleViewDisabled = false,
    isEpic = false,
  } = props;

  const visibleSections = getVisibleSections(layoutDisplayFiltersOptions, displayFilters);
  const { groupByOptions, subGroupByOptions, orderByOptions } = visibleSections;

  const computedIgnoreGroupedFilters: Partial<TIssueGroupByOptions>[] = [...ignoreGroupedFilters];
  if (cycleViewDisabled) computedIgnoreGroupedFilters.push("cycle");
  if (moduleViewDisabled) computedIgnoreGroupedFilters.push("module");

  return (
    <div className="vertical-scrollbar relative scrollbar-sm h-full w-full divide-y divide-subtle-1 overflow-hidden overflow-y-auto px-2.5">
      {/* display properties */}
      {visibleSections.displayProperties && layoutDisplayFiltersOptions && (
        <div className="py-2">
          <FilterDisplayProperties
            displayProperties={displayProperties}
            displayPropertiesToRender={layoutDisplayFiltersOptions.display_properties}
            handleUpdate={handleDisplayPropertiesUpdate}
            cycleViewDisabled={cycleViewDisabled}
            moduleViewDisabled={moduleViewDisabled}
            isEpic={isEpic}
          />
        </div>
      )}

      {/* group by */}
      {visibleSections.groupBy && (
        <div className="py-2">
          <FilterGroupBy
            displayFilters={displayFilters}
            groupByOptions={groupByOptions}
            handleUpdate={(val) =>
              handleDisplayFiltersUpdate({
                group_by: val,
              })
            }
            ignoreGroupedFilters={computedIgnoreGroupedFilters}
          />
        </div>
      )}

      {/* sub-group by */}
      {visibleSections.subGroupBy && displayFilters && (
        <div className="py-2">
          <FilterSubGroupBy
            displayFilters={displayFilters}
            handleUpdate={(val) =>
              handleDisplayFiltersUpdate({
                sub_group_by: val,
              })
            }
            subGroupByOptions={subGroupByOptions}
            ignoreGroupedFilters={computedIgnoreGroupedFilters}
          />
        </div>
      )}

      {/* order by */}
      {visibleSections.orderBy && (
        <div className="py-2">
          <FilterOrderBy
            selectedOrderBy={displayFilters?.order_by}
            handleUpdate={(val) =>
              handleDisplayFiltersUpdate({
                order_by: val,
              })
            }
            orderByOptions={orderByOptions}
          />
        </div>
      )}

      {/* Options */}
      {visibleSections.extraOptions && layoutDisplayFiltersOptions && (
        <div className="py-2">
          <FilterExtraOptions
            selectedExtraOptions={{
              show_empty_groups: displayFilters?.show_empty_groups ?? true,
              sub_issue: displayFilters?.sub_issue ?? true,
            }}
            handleUpdate={(key, val) =>
              handleDisplayFiltersUpdate({
                [key]: val,
              })
            }
            enabledExtraOptions={layoutDisplayFiltersOptions.extra_options.values}
          />
        </div>
      )}
    </div>
  );
});
