/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useRef, useState } from "react";
import { observer } from "mobx-react";
import { CalendarDays } from "lucide-react";
import { Popover } from "@plane/propel/popover";
// ui
import type { Matcher } from "@plane/propel/calendar";
import { Calendar } from "@plane/propel/calendar";
import { CloseIcon } from "@plane/propel/icons";
import { cn, renderFormattedDate, getDate } from "@plane/utils";
// hooks
import { useUserProfile } from "@/hooks/store/user";
import { useDropdown } from "@/hooks/use-dropdown";
// components
import { DropdownButton } from "./buttons";
// constants
import { BUTTON_VARIANTS_WITH_TEXT } from "./constants";
// types
import type { TDropdownProps } from "./types";

type Props = TDropdownProps & {
  clearIconClassName?: string;
  defaultOpen?: boolean;
  optionsClassName?: string;
  icon?: React.ReactNode;
  isClearable?: boolean;
  minDate?: Date;
  maxDate?: Date;
  onChange: (val: Date | null) => void;
  onClose?: () => void;
  value: Date | string | null;
  closeOnSelect?: boolean;
  formatToken?: string;
  renderByDefault?: boolean;
  labelClassName?: string;
};

export const DateDropdown = observer(function DateDropdown(props: Props) {
  const { data } = useUserProfile();
  return <DateDropdownView {...props} weekStartsOn={data?.start_of_the_week} />;
});

export function DateDropdownView(
  props: Props & { weekStartsOn?: React.ComponentProps<typeof Calendar>["weekStartsOn"] }
) {
  const {
    buttonClassName,
    buttonContainerClassName,
    buttonVariant,
    className,
    clearIconClassName,
    defaultOpen = false,
    optionsClassName,
    closeOnSelect = true,
    disabled,
    hideIcon,
    icon = <CalendarDays className="h-3 w-3 flex-shrink-0" />,
    isClearable = true,
    minDate,
    maxDate,
    onChange,
    onClose,
    placeholder = "Date",
    placement,
    showTooltip = false,
    tabIndex,
    value,
    formatToken,
    renderByDefault = true,
    labelClassName,
    weekStartsOn,
  } = props;
  // states
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isDateSelected = value && value.toString().trim() !== "";
  const withText = BUTTON_VARIANTS_WITH_TEXT.includes(buttonVariant);
  const canClear = isClearable && !disabled && isDateSelected;

  const { handleClose, handleOpenChange } = useDropdown({ onClose, setIsOpen });

  const dropdownOnChange = (val: Date | null) => {
    onChange(val);
    if (closeOnSelect) {
      handleClose();
    }
  };

  const disabledDays: Matcher[] = [];
  if (minDate) disabledDays.push({ before: minDate });
  if (maxDate) disabledDays.push({ after: maxDate });

  const clearButton = canClear && (
    <button
      type="button"
      aria-label={`Clear ${placeholder}`}
      className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-primary hover:bg-layer-transparent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
      onClick={(event) => {
        event.stopPropagation();
        onChange(null);
        if (isOpen) handleClose();
        triggerRef.current?.focus();
      }}
    >
      <CloseIcon
        className={cn(
          "h-2.5 w-2.5 shrink-0",
          clearIconClassName,
          "group-focus-within/date:inline group-hover/date:inline [@media(hover:none)]:inline"
        )}
      />
    </button>
  );

  return (
    <div className={cn("group/date relative h-full", className)}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <Popover.Button
          ref={triggerRef}
          aria-label={placeholder}
          className={cn(
            "clickable block h-full max-w-full outline-none",
            disabled ? "cursor-not-allowed text-secondary" : "cursor-pointer",
            buttonContainerClassName
          )}
          disabled={disabled}
          tabIndex={tabIndex}
          render={(triggerProps) => (
            // The primitive blocks disabled actions; the native trigger retains focus during a save.
            <button {...triggerProps} disabled={false} aria-disabled={disabled}>
              <DropdownButton
                className={cn(buttonClassName, canClear && "pr-8")}
                isActive={isOpen}
                tooltipHeading={placeholder}
                tooltipContent={value ? renderFormattedDate(value, formatToken) : "None"}
                showTooltip={showTooltip}
                variant={buttonVariant}
                renderToolTipByDefault={renderByDefault}
              >
                {!hideIcon && icon}
                {withText && (
                  <span className={cn("flex-grow truncate text-left text-body-xs-medium", labelClassName)}>
                    {value ? renderFormattedDate(value, formatToken) : placeholder}
                  </span>
                )}
              </DropdownButton>
            </button>
          )}
        />
        {clearButton}
        <Popover.Panel
          aria-label={placeholder}
          finalFocus={triggerRef}
          placement={placement ?? "bottom-start"}
          sideOffset={4}
          positionerClassName="z-[120]"
          data-prevent-outside-click
          className={cn(
            "overflow-hidden rounded-md border border-strong bg-surface-1 shadow-raised-200",
            optionsClassName
          )}
        >
          <Calendar
            className="p-3"
            captionLayout="dropdown"
            selected={getDate(value)}
            defaultMonth={getDate(value)}
            onSelect={(date: Date | undefined) => dropdownOnChange(date ?? null)}
            showOutsideDays
            initialFocus
            disabled={disabledDays}
            mode="single"
            fixedWeeks
            weekStartsOn={weekStartsOn}
          />
        </Popover.Panel>
      </Popover>
    </div>
  );
}
