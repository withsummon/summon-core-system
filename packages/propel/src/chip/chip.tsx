/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import { SelectableIcon } from "../icons/selectable-icon";
import type { TSelectableIcon } from "../icons/selectable-icon";
import { cn } from "../utils/classname";

export type ChipProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** Pressed state; exposed as `aria-pressed` so the icon fills and assistive tech hears the toggle. */
  selected?: boolean;
  icon?: TSelectableIcon;
  count?: number;
  children: React.ReactNode;
};

/** A toggleable filter chip: outline icon at rest, filled icon and accent tint once pressed. */
export const Chip = React.forwardRef(function Chip(
  { selected = false, icon, count, className, children, type = "button", ...props }: ChipProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        "group/select inline-flex h-8 shrink-0 press items-center gap-1.5 rounded-full border px-3 text-13 font-medium whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-accent-subtle disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-accent-strong/35 bg-accent-subtle text-accent-primary"
          : "border-subtle bg-surface-1 text-secondary shadow-raised-100 hover:bg-layer-1 hover:text-primary [&_svg]:text-tertiary",
        className
      )}
      {...props}
    >
      {icon && <SelectableIcon icon={icon} className="size-3.5" />}
      {children}
      {count !== undefined && (
        <span
          className={cn(
            "min-w-5 rounded-full px-1.5 text-center text-11 leading-4 font-semibold tabular-nums",
            selected ? "bg-accent-primary text-on-color" : "bg-layer-1 text-tertiary"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
});

Chip.displayName = "Chip";
