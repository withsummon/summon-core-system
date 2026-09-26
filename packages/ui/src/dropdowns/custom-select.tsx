/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { SelectPrimitive as Select } from "@plane/propel/select";
import { CheckIcon, ChevronDownIcon } from "@plane/propel/icons";
import { convertPlacementToSideAndAlign } from "@plane/propel/utils";
import { cn } from "../utils";
import type { ICustomSelectItemProps, ICustomSelectProps } from "./helper";

function CustomSelect({
  customButtonClassName,
  buttonClassName,
  placement = "bottom-start",
  children,
  className,
  customButton,
  render,
  disabled = false,
  input = false,
  label,
  maxHeight = "md",
  noChevron = false,
  onChange,
  optionsClassName,
  value,
  tabIndex,
}: ICustomSelectProps) {
  const { side, align } = convertPlacementToSideAndAlign(placement);
  return (
    <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
      <div className={cn("relative flex-shrink-0 text-left", className)}>
        <Select.Trigger
          render={render}
          tabIndex={tabIndex}
          className={cn(
            "flex w-full items-center justify-between gap-1 rounded text-11 outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40 disabled:cursor-not-allowed disabled:opacity-50",
            render || customButton
              ? customButtonClassName
              : ["border border-strong", input ? "px-3 py-2 text-13" : "px-2 py-1", buttonClassName]
          )}
        >
          {render ? undefined : (customButton ?? label)}
          {!render && !customButton && !noChevron && <ChevronDownIcon className="size-3" />}
        </Select.Trigger>
      </div>
      <Select.Portal>
        <Select.Positioner side={side} align={align} sideOffset={4} alignItemWithTrigger={false} className="z-[120]">
          <Select.Popup
            className={cn(
              "min-w-48 overflow-y-auto rounded-md border border-subtle-1 bg-surface-1 p-2 text-11 shadow-raised-200 outline-none",
              {
                "max-h-60": maxHeight === "lg",
                "max-h-48": maxHeight === "md",
                "max-h-36": maxHeight === "rg",
                "max-h-28": maxHeight === "sm",
              },
              optionsClassName
            )}
          >
            {children}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

function Option({ children, value, className }: ICustomSelectItemProps) {
  return (
    <Select.Item
      value={value}
      className={cn(
        "flex cursor-pointer items-center justify-between gap-2 rounded-sm px-1 py-1.5 text-secondary outline-none select-none data-[highlighted]:bg-layer-transparent-hover",
        className
      )}
    >
      <Select.ItemText className="min-w-0 flex-1">{children}</Select.ItemText>
      <Select.ItemIndicator>
        <CheckIcon className="size-3.5 flex-shrink-0" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}
CustomSelect.Option = Option;
export { CustomSelect };
