/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "../utils/classname";

export interface IToggleSwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  tabIndex?: number;
}

type TSwitchSize = NonNullable<IToggleSwitchProps["size"]>;

const TRACK_SIZE_CLASSNAME: Record<TSwitchSize, string> = { sm: "h-4 w-6", md: "h-5 w-8", lg: "h-6 w-10" };
const THUMB_SIZE_CLASSNAME: Record<TSwitchSize, string> = { sm: "h-3 w-3", md: "h-4 w-4", lg: "h-5 w-5" };
const THUMB_CHECKED_CLASSNAME: Record<TSwitchSize, string> = {
  sm: "translate-x-3",
  md: "translate-x-4",
  lg: "translate-x-5",
};

const getTrackStateClassName = (checked: boolean, disabled: boolean | undefined) => {
  if (disabled) return "cursor-not-allowed border-subtle bg-layer-1";
  return checked
    ? "cursor-pointer border-transparent bg-accent-primary"
    : "cursor-pointer border-strong bg-layer-3-active";
};

function Switch({ value, onChange, label, size = "sm", disabled, className, tabIndex }: IToggleSwitchProps) {
  return (
    <BaseSwitch.Root
      checked={value}
      disabled={disabled}
      onCheckedChange={onChange}
      aria-label={label}
      tabIndex={tabIndex}
      className={cn(
        "relative inline-flex flex-shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong focus-visible:outline-solid motion-reduce:transition-none",
        TRACK_SIZE_CLASSNAME[size],
        getTrackStateClassName(value, disabled),
        className
      )}
    >
      {label && <span className="sr-only">{label}</span>}
      <BaseSwitch.Thumb
        aria-hidden="true"
        className={cn(
          "inline-block self-center rounded-full shadow-raised-100 ring-0 transition-transform duration-150 ease-out motion-reduce:transition-none",
          THUMB_SIZE_CLASSNAME[size],
          // position + color by state
          value ? THUMB_CHECKED_CLASSNAME[size] : "translate-x-0.5",
          "bg-white",
          // disabled
          disabled && "cursor-not-allowed bg-surface-2"
        )}
      />
    </BaseSwitch.Root>
  );
}

Switch.displayName = "plane-ui-switch";

export { Switch };
