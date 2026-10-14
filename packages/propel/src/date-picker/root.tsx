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

const DISPLAY_DATE_FORMAT = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });

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

/** Controlled-or-uncontrolled `YYYY-MM-DD` value. */
function useDateValue(controlled: string | undefined, defaultValue: string, onValueChange?: (value: string) => void) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ?? uncontrolled;

  const commit = (next: string) => {
    if (controlled === undefined) setUncontrolled(next);
    onValueChange?.(next);
  };

  return [value, commit] as const;
}

function CalendarGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 flex-none text-tertiary" fill="none">
      <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

type DatePickerPopupProps = {
  selected: Date | undefined;
  minDate: Date | undefined;
  maxDate: Date | undefined;
  onSelect: (date: Date | undefined) => void;
};

function DatePickerPopup({ selected, minDate, maxDate, onSelect }: DatePickerPopupProps) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner side="bottom" align="start" sideOffset={4} className="z-[120]">
        <BasePopover.Popup data-slot="date-picker-popup" className={cn(POPUP_CLASSNAME, "p-0")}>
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? minDate}
            onSelect={onSelect}
            disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
          />
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
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
  const [value, commit] = useDateValue(controlled, defaultValue, onValueChange);
  const [open, setOpen] = useState(false);
  const selected = value ? toDate(value) : undefined;
  const isClearable = clearable && !!value;

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
            isClearable ? "pr-9" : ""
          )}
          {...aria}
        >
          <CalendarGlyph />
          <span className={cn("min-w-0 flex-1 truncate", selected ? "text-primary" : "text-placeholder")}>
            {selected ? DISPLAY_DATE_FORMAT.format(selected) : placeholder}
          </span>
        </BasePopover.Trigger>
        {isClearable && !disabled ? (
          <button
            type="button"
            aria-label="Clear date"
            onClick={() => commit("")}
            className="absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-md text-tertiary hover:bg-layer-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-accent-strong focus-visible:outline-solid"
          >
            <CloseIcon className="size-3.5" />
          </button>
        ) : null}
        {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      </div>
      <DatePickerPopup
        selected={selected}
        minDate={min ? toDate(min) : undefined}
        maxDate={max ? toDate(max) : undefined}
        onSelect={(date) => {
          commit(date ? toValue(date) : "");
          setOpen(false);
        }}
      />
    </BasePopover.Root>
  );
});
