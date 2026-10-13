/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { memo, useState } from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { Calendar } from "../calendar/root";
import { CloseIcon } from "../icons/actions/close-icon";
import { FIELD_CLASSNAME } from "../input/field";
import { POPUP_CLASSNAME } from "../popover/surface";
import { cn } from "../utils/classname";

/** Dates travel as local calendar days in `YYYY-MM-DD`, the same format a native date input submits. */
const toDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : undefined;
};

const toValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export interface DatePickerProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Submits the value through a hidden input, so the picker works inside native forms. */
  name?: string;
  id?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  clearable?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
}

/** Base UI popover around the propel calendar. The trigger is a native button so a wrapping <label> names it. */
export const DatePicker = memo(function DatePicker({
  value: controlled,
  defaultValue = "",
  onValueChange,
  name,
  id,
  min,
  max,
  disabled,
  required,
  placeholder = "Pick a date",
  clearable = true,
  className,
  ...aria
}: DatePickerProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const value = controlled ?? uncontrolled;
  const selected = value ? toDate(value) : undefined;
  const minDate = min ? toDate(min) : undefined;
  const maxDate = max ? toDate(max) : undefined;

  const commit = (next: string) => {
    if (controlled === undefined) setUncontrolled(next);
    onValueChange?.(next);
  };

  return (
    <BasePopover.Root open={open} onOpenChange={setOpen}>
      <div className={cn("relative flex h-9 w-full min-w-0", className)}>
        <BasePopover.Trigger
          id={id}
          disabled={disabled}
          data-slot="date-picker-trigger"
          className={cn(
            FIELD_CLASSNAME,
            "flex h-full w-full min-w-0 items-center gap-2 px-3 text-left hover:bg-layer-2-hover",
            "disabled:cursor-not-allowed disabled:opacity-60 data-[popup-open]:border-accent-strong",
            clearable && value ? "pr-9" : ""
          )}
          {...aria}
        >
          <svg aria-hidden viewBox="0 0 16 16" className="size-4 flex-none text-tertiary" fill="none">
            <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span className={cn("min-w-0 flex-1 truncate", selected ? "text-primary" : "text-placeholder")}>
            {selected
              ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(selected)
              : placeholder}
          </span>
        </BasePopover.Trigger>
        {clearable && value && !disabled ? (
          <button
            type="button"
            aria-label="Clear date"
            onClick={() => commit("")}
            className="absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-md text-tertiary hover:bg-layer-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-accent-strong"
          >
            <CloseIcon className="size-3.5" />
          </button>
        ) : null}
        {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      </div>
      <BasePopover.Portal>
        <BasePopover.Positioner side="bottom" align="start" sideOffset={4} className="z-[120]">
          <BasePopover.Popup data-slot="date-picker-popup" className={cn(POPUP_CLASSNAME, "p-0")}>
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected ?? minDate}
              onSelect={(date) => {
                commit(date ? toValue(date) : "");
                setOpen(false);
              }}
              disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
            />
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
});
