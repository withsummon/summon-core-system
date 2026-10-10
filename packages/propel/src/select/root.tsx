/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { memo } from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { CheckIcon } from "../icons/actions/check-icon";
import { ChevronDownIcon } from "../icons/arrows/chevron-down";
import { cn } from "../utils/classname";

export type SelectOption = { value: string; label: React.ReactNode; disabled?: boolean };

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Submits the value through a hidden input, so the select works inside native forms. */
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: React.ReactNode;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  popupClassName?: string;
}

const TRIGGER_CLASSNAME = cn(
  "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-subtle bg-surface-1 px-3 text-left text-13 text-primary shadow-raised-100 outline-none",
  "transition-[border-color,background-color] duration-150 hover:bg-layer-1 focus-visible:border-accent-strong focus-visible:ring-[3px] focus-visible:ring-accent-subtle",
  "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 data-[popup-open]:border-accent-strong motion-reduce:transition-none"
);

function SelectPopup({ options, popupClassName }: { options: SelectOption[]; popupClassName?: string }) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner sideOffset={4} alignItemWithTrigger={false} className="z-[120] outline-none">
        <BaseSelect.Popup
          data-slot="select-popup"
          className={cn(
            "max-h-[min(20rem,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto rounded-xl border border-subtle bg-surface-1 p-1 text-13 text-primary shadow-overlay-100 outline-none",
            "origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 motion-reduce:transition-none",
            popupClassName
          )}
        >
          {options.map((option) => (
            <BaseSelect.Item
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="flex min-h-9 cursor-default items-center gap-2 rounded-md px-2 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-layer-1"
            >
              <span className="flex size-4 flex-none items-center text-accent-primary">
                <BaseSelect.ItemIndicator>
                  <CheckIcon className="size-4" />
                </BaseSelect.ItemIndicator>
              </span>
              <BaseSelect.ItemText className="min-w-0 flex-1 truncate">{option.label}</BaseSelect.ItemText>
            </BaseSelect.Item>
          ))}
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

/**
 * Base UI select. The trigger is a native button, so a wrapping <label> names it the same way it names a native
 * <select>. The popup sits above dialogs so it can be used inside them.
 */
export const Select = memo(function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  id,
  disabled,
  required,
  placeholder,
  className,
  popupClassName,
  ...aria
}: SelectProps) {
  return (
    <BaseSelect.Root
      items={options}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => onValueChange?.(next as string)}
      name={name}
      disabled={disabled}
      required={required}
    >
      <BaseSelect.Trigger
        id={id}
        nativeButton
        render={<button type="button" />}
        data-slot="select-trigger"
        className={cn(TRIGGER_CLASSNAME, className)}
        {...aria}
      >
        <BaseSelect.Value className="min-w-0 flex-1 truncate data-[placeholder]:text-placeholder">
          {(selected: string | null) =>
            selected === null || selected === undefined
              ? placeholder
              : (options.find((option) => option.value === selected)?.label ?? placeholder)
          }
        </BaseSelect.Value>
        <BaseSelect.Icon className="flex-none text-tertiary">
          <ChevronDownIcon className="size-4" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <SelectPopup options={options} popupClassName={popupClassName} />
    </BaseSelect.Root>
  );
});

export interface MultiSelectProps extends Omit<SelectProps, "value" | "defaultValue" | "onValueChange"> {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (values: string[]) => void;
}

/** Multiple-choice variant; the trigger summarizes the selection instead of listing it. */
export const MultiSelect = memo(function MultiSelect({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  id,
  disabled,
  required,
  placeholder = "None selected",
  className,
  popupClassName,
  ...aria
}: MultiSelectProps) {
  return (
    <BaseSelect.Root
      multiple
      items={options}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => onValueChange?.(next as string[])}
      name={name}
      disabled={disabled}
      required={required}
    >
      <BaseSelect.Trigger
        id={id}
        nativeButton
        render={<button type="button" />}
        data-slot="select-trigger"
        className={cn(TRIGGER_CLASSNAME, className)}
        {...aria}
      >
        <BaseSelect.Value className="min-w-0 flex-1 truncate">
          {(selected: string[]) => {
            const labels = options.filter((option) => selected.includes(option.value)).map((option) => option.label);
            if (!labels.length) return <span className="text-placeholder">{placeholder}</span>;
            return labels.length === 1 ? labels[0] : `${labels.length} selected`;
          }}
        </BaseSelect.Value>
        <BaseSelect.Icon className="flex-none text-tertiary">
          <ChevronDownIcon className="size-4" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <SelectPopup options={options} popupClassName={popupClassName} />
    </BaseSelect.Root>
  );
});
