/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { CustomSearchSelect } from "@plane/ui";
import { cn } from "@plane/utils";
// hooks
import useTimezone from "@/hooks/use-timezone";

type TTimezoneSelect = {
  value: string | undefined;
  onChange: (value: string) => void;
  error?: boolean;
  label?: string;
  buttonClassName?: string;
  className?: string;
  optionsClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

export function TimezoneSelect(props: TTimezoneSelect) {
  // props
  const {
    value,
    onChange,
    error = false,
    label = "Select a timezone",
    buttonClassName = "",
    className = "",
    optionsClassName = "",
    disabled = false,
    ariaLabel,
  } = props;
  // hooks
  const { timezones, selectedValue } = useTimezone();

  return (
    <div>
      <CustomSearchSelect
        ariaLabel={ariaLabel}
        value={value}
        label={value ? selectedValue(value) : label}
        options={timezones}
        onChange={onChange}
        buttonClassName={cn(buttonClassName, "border border-subtle-1", {
          "border-danger-strong": error,
        })}
        className={cn("rounded-md", className)}
        optionsClassName={cn("w-72", optionsClassName)}
        input
        disabled={disabled}
        placement="bottom-end"
      />
    </div>
  );
}
