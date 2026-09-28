/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { getButtonStyling } from "@plane/propel/button";
import { ChevronDownIcon } from "@plane/propel/icons";
import { CustomMenu } from "@plane/ui";
import { FilterHeader, FilterOption } from "@/components/issues/issue-layouts/filters";

type Props<Value extends string> = {
  appliedFilters: readonly Value[];
  handleUpdate: (role: Value) => void;
  options: readonly { value: Value; label: string }[];
};

export function MemberListFiltersDropdown<Value extends string>({
  appliedFilters,
  handleUpdate,
  options,
}: Props<Value>) {
  const [expanded, setExpanded] = useState(true);
  const count = appliedFilters.length;
  return (
    <CustomMenu
      ariaLabel="Filter members"
      customButtonClassName={getButtonStyling("secondary", "lg")}
      customButton={
        <span className="relative flex items-center gap-2">
          <span>Filters</span>
          <ChevronDownIcon className="h-3 w-3" aria-hidden="true" />
          {count > 0 && <span className="absolute -top-2 -right-4 size-2 rounded-full bg-accent-primary" />}
        </span>
      }
      placement="bottom-start"
    >
      <div className="space-y-2">
        <FilterHeader
          title={`Roles${count > 0 ? ` (${count})` : ""}`}
          isPreviewEnabled={expanded}
          handleIsPreviewEnabled={() => setExpanded(!expanded)}
        />
        {expanded && (
          <div className="space-y-1">
            {options.map((option) => (
              <FilterOption
                key={option.value}
                isChecked={appliedFilters.includes(option.value)}
                title={option.label}
                onClick={() => handleUpdate(option.value)}
              />
            ))}
          </div>
        )}
      </div>
    </CustomMenu>
  );
}
