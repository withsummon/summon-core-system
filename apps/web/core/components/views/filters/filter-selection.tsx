/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";

import type { TViewFilterProps, TViewFilters } from "@plane/types";
import { EViewAccess } from "@plane/types";
// components
import { FilterCreatedDate } from "@/components/common/filters/created-at";
import { FilterCreatedBy } from "@/components/common/filters/created-by";
import { FiltersSearch } from "@/components/common/filters/filters-search";
import { FilterOption } from "@/components/issues/issue-layouts/filters";

type Props = {
  filters: TViewFilters;
  handleFiltersUpdate: <T extends keyof TViewFilters>(filterKey: T, filterValue: TViewFilters[T]) => void;
  memberIds?: string[] | undefined;
};

export const ViewFiltersSelection = observer(function ViewFiltersSelection(props: Props) {
  const { filters, handleFiltersUpdate, memberIds } = props;
  // states
  const [filtersSearchQuery, setFiltersSearchQuery] = useState("");

  // handles filter update
  const handleFilters = (key: keyof TViewFilterProps, value: boolean | string | EViewAccess | string[]) => {
    let currValues = (filters.filters?.[key] ?? []) as (string | EViewAccess)[];

    if (typeof currValues === "boolean" && typeof value === "boolean") return;

    if (Array.isArray(currValues) && typeof value !== "boolean") {
      // toggle each value: remove when already applied, otherwise append
      const nextValues = new Set(currValues);
      for (const val of Array.isArray(value) ? value : [value]) {
        if (nextValues.has(val)) nextValues.delete(val);
        else nextValues.add(val);
      }
      currValues = Array.from(nextValues);
    }

    handleFiltersUpdate("filters", {
      ...filters.filters,
      [key]: currValues,
    });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <FiltersSearch value={filtersSearchQuery} onChange={setFiltersSearchQuery} />
      <div className="vertical-scrollbar scrollbar-sm h-full w-full divide-y divide-subtle-1 overflow-y-auto px-2.5">
        <div className="py-2">
          <FilterOption
            isChecked={!!filters.filters?.favorites}
            onClick={() =>
              handleFiltersUpdate("filters", {
                ...filters.filters,
                favorites: !filters.filters?.favorites,
              })
            }
            title="Favorites"
          />
        </div>

        {/* created date */}
        <div className="py-2">
          <FilterCreatedDate
            appliedFilters={filters.filters?.created_at ?? null}
            handleUpdate={(val: string | string[]) => handleFilters("created_at", val)}
            searchQuery={filtersSearchQuery}
          />
        </div>

        {/* created by */}
        <div className="py-2">
          <FilterCreatedBy
            appliedFilters={filters.filters?.owned_by ?? null}
            handleUpdate={(val) => handleFilters("owned_by", val)}
            searchQuery={filtersSearchQuery}
            memberIds={memberIds}
          />
        </div>
      </div>
    </div>
  );
});
