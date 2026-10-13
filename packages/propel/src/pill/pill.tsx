/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import { cn } from "../utils";
import { EPillSize, EPillVariant, ERadius } from "./constants";
import type { TPillSize, TPillVariant, TRadius } from "./constants";

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: TPillVariant;
  size?: TPillSize;
  className?: string;
  children: React.ReactNode;
  radius?: TRadius;
}

const pillVariants = {
  [EPillVariant.DEFAULT]: "bg-surface-2 text-secondary border border-subtle-1",
  [EPillVariant.PRIMARY]: "bg-accent-primary/10 text-accent-primary border border-accent-strong/20",
  [EPillVariant.SUCCESS]: "bg-success-subtle text-success-primary border border-success-subtle",
  [EPillVariant.WARNING]: "bg-warning-subtle text-warning-primary border border-warning-subtle",
  [EPillVariant.ERROR]: "bg-danger-subtle text-danger-primary border border-danger-subtle",
  [EPillVariant.INFO]: "bg-accent-subtle text-accent-primary border border-accent-subtle",
};

const pillSizes = {
  [EPillSize.XS]: "px-1.5 py-0.5 text-11",
  [EPillSize.SM]: "px-2 py-0.5 text-11",
  [EPillSize.MD]: "px-2.5 py-1 text-13",
  [EPillSize.LG]: "px-3 py-1.5 text-14",
};

const pillRadius = {
  [ERadius.SQUARE]: "rounded",
  [ERadius.CIRCLE]: "rounded-full",
};

const Pill = React.forwardRef(function Pill(
  {
    variant = EPillVariant.DEFAULT,
    size = EPillSize.MD,
    radius = ERadius.CIRCLE,
    className,
    children,
    ...props
  }: PillProps,
  ref: React.ForwardedRef<HTMLSpanElement>
) {
  return (
    <span
      ref={ref}
      className={cn(
        // Base styles
        "inline-flex items-center justify-center rounded-full font-medium whitespace-nowrap",
        // Variant styles
        pillVariants[variant],
        // Size styles
        pillSizes[size],
        // Radius styles
        pillRadius[radius],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
});

Pill.displayName = "Pill";

export { Pill };
