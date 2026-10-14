/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { SelectPrimitive as Select } from "@plane/propel/select";
import { CheckIcon, ChevronDownIcon } from "@plane/propel/icons";
import { FIELD_CLASSNAME } from "@plane/propel/input";
import { POPUP_CLASSNAME, POPUP_OPTION_CLASSNAME } from "@plane/propel/popover";
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
            "flex w-full items-center justify-between gap-2 outline-none disabled:cursor-not-allowed disabled:opacity-50",
            render || customButton
              ? [
                  "focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid",
                  customButtonClassName,
                ]
              : [FIELD_CLASSNAME, input ? "h-9 px-3" : "h-8 px-2.5", buttonClassName]
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
              "min-w-[max(12rem,var(--anchor-width))] overflow-y-auto",
              POPUP_CLASSNAME,
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
    <Select.Item value={value} className={cn(POPUP_OPTION_CLASSNAME, className)}>
      <Select.ItemText className="min-w-0 flex-1">{children}</Select.ItemText>
      <Select.ItemIndicator>
        <CheckIcon className="size-3.5 flex-shrink-0" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}
CustomSelect.Option = Option;
export { CustomSelect };
