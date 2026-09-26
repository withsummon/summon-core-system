/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState } from "react";
import type { TPlacement as Placement } from "@plane/propel/utils";
import { Popover } from "@plane/propel/popover";
import { Button } from "@plane/propel/button";

type Props = {
  children: React.ReactNode;
  icon?: React.ReactElement;
  miniIcon?: React.ReactNode;
  title?: string;
  placement?: Placement;
  disabled?: boolean;
  tabIndex?: number;
  menuButton?: React.ReactNode;
  isFiltersApplied?: boolean;
};

export function FiltersDropdown(props: Props) {
  const [open, setOpen] = useState(false);
  const {
    children,
    miniIcon,
    icon,
    title = "Dropdown",
    placement,
    disabled = false,
    tabIndex,
    menuButton,
    isFiltersApplied = false,
  } = props;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Button
        render={<Button disabled={disabled} variant="secondary" tabIndex={tabIndex} size="lg" className="relative" />}
      >
        {menuButton || (
          <>
            <span className="hidden items-center gap-1.5 @4xl:flex">
              {icon}
              <span className={open ? "text-primary" : "text-secondary"}>{title}</span>
            </span>
            <span className="flex @4xl:hidden">{miniIcon || title}</span>
            {isFiltersApplied && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent-primary" />
            )}
          </>
        )}
      </Popover.Button>
      <Popover.Panel
        placement={placement?.startsWith("auto") ? "bottom-start" : placement}
        positionerClassName="z-50"
        className="overflow-hidden rounded-md border border-subtle bg-surface-1 shadow-raised-100"
      >
        <div className="flex max-h-[min(30rem,var(--available-height))] w-[18.75rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden">
          {children}
        </div>
      </Popover.Panel>
    </Popover>
  );
}
