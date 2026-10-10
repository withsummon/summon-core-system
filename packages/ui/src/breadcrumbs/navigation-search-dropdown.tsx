/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import { useState } from "react";
import { Tooltip } from "@plane/propel/tooltip";
import type { ICustomSearchSelectOption } from "@plane/types";
import { CustomSearchSelect } from "../dropdowns";
import { cn } from "../utils";
import { Breadcrumbs } from "./breadcrumbs";

type TBreadcrumbNavigationSearchDropdownProps = {
  icon?: React.ReactNode;
  title?: string;
  selectedItem: string;
  navigationItems: ICustomSearchSelectOption[];
  onChange?: (value: string) => void;
  navigationDisabled?: boolean;
  isLast?: boolean;
  handleOnClick?: () => void;
  disableRootHover?: boolean;
  shouldTruncate?: boolean;
};

export function BreadcrumbNavigationSearchDropdown(props: TBreadcrumbNavigationSearchDropdownProps) {
  const {
    icon,
    title,
    selectedItem,
    navigationItems,
    onChange,
    navigationDisabled = false,
    isLast = false,
    handleOnClick,
    shouldTruncate = false,
  } = props;
  // state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const label = (
    <>
      {shouldTruncate && <div className="flex text-tertiary @4xl:hidden">...</div>}
      <div
        className={cn("flex gap-2", {
          "hidden items-center gap-2 @4xl:flex": shouldTruncate,
        })}
      >
        {icon && <Breadcrumbs.Icon>{icon}</Breadcrumbs.Icon>}
        <Breadcrumbs.Label>{title}</Breadcrumbs.Label>
      </div>
    </>
  );
  const labelClassName =
    "flex h-full items-center gap-2 rounded-sm rounded-r-none px-1.5 py-1 text-13 font-medium text-tertiary";
  const separator = (
    <Breadcrumbs.Separator
      className={cn("rounded-r-sm", {
        "bg-layer-1": isDropdownOpen && !isLast,
        "hover:bg-layer-1": !isLast,
      })}
      containerClassName="p-0"
      iconClassName={cn("group-hover:rotate-90 hover:text-primary", {
        "text-primary": isDropdownOpen,
        "rotate-90": isDropdownOpen || isLast,
      })}
      showDivider={!isLast}
    />
  );
  const renderDropdown = (customButton: React.ReactNode) => (
    <CustomSearchSelect
      onOpen={() => {
        setIsDropdownOpen(true);
      }}
      onClose={() => {
        setIsDropdownOpen(false);
      }}
      options={navigationItems}
      value={selectedItem}
      onChange={(value: string) => {
        if (value !== selectedItem) {
          onChange?.(value);
        }
      }}
      customButton={customButton}
      disabled={navigationDisabled}
      className="h-full rounded-sm"
      customButtonClassName={cn(
        "group flex h-full cursor-pointer items-center gap-0.5 rounded-sm outline-none hover:bg-surface-2",
        {
          "bg-surface-2": isDropdownOpen,
        }
      )}
    />
  );

  // The last crumb only opens its switcher, so its label lives inside the trigger.
  if (isLast)
    return renderDropdown(
      <>
        <Tooltip tooltipContent={title} position="bottom">
          <span className={labelClassName}>{label}</span>
        </Tooltip>
        {separator}
      </>
    );

  // Earlier crumbs navigate from the label and switch from the chevron: two sibling controls,
  // never a button nested inside the trigger button.
  return (
    <div className="group flex h-full items-center rounded-sm">
      <Tooltip tooltipContent={title} position="bottom">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOnClick?.();
          }}
          className={cn(labelClassName, "cursor-pointer hover:bg-layer-1 hover:text-primary")}
        >
          {label}
        </button>
      </Tooltip>
      {renderDropdown(separator)}
    </div>
  );
}
