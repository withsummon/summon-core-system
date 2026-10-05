/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import { SearchIcon, CloseIcon } from "@plane/propel/icons";
import { useIssueFilter } from "@/hooks/store/use-issue-filter";
import { FilterPriority } from "./priority";
import { FilterState } from "./state";

export function FilterSelection() {
  const { selectedStates, selectedPriorities, change } = useIssueFilter();
  const [filtersSearchQuery, setFiltersSearchQuery] = useState("");

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="p-2.5 pb-0">
        <div className="flex items-center gap-1.5 rounded-sm border-[0.5px] border-subtle bg-surface-2 px-1.5 py-1 text-11">
          <SearchIcon className="text-placeholder" width={12} height={12} strokeWidth={2} />
          <input
            aria-label="Search filters"
            type="text"
            className="w-full bg-surface-2 outline-none placeholder:text-placeholder"
            placeholder="Search"
            value={filtersSearchQuery}
            onChange={(e) => setFiltersSearchQuery(e.target.value)}
          />
          {filtersSearchQuery !== "" && (
            <button
              type="button"
              aria-label="Clear filter search"
              className="grid place-items-center"
              onClick={() => setFiltersSearchQuery("")}
            >
              <CloseIcon className="text-tertiary" height={12} width={12} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
      <div className="h-full w-full divide-y divide-subtle-1 overflow-y-auto px-2.5">
        {/* priority */}
        {
          <div className="py-2">
            <FilterPriority
              appliedFilters={selectedPriorities}
              handleUpdate={(val) => change("priority", val)}
              searchQuery={filtersSearchQuery}
            />
          </div>
        }

        {/* state */}
        {
          <div className="py-2">
            <FilterState
              appliedFilters={selectedStates}
              handleUpdate={(val) => change("state", val)}
              searchQuery={filtersSearchQuery}
            />
          </div>
        }
      </div>
    </div>
  );
}
