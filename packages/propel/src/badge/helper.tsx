/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

export const badgeVariants = cva("inline-flex items-center justify-center gap-1 whitespace-nowrap transition-colors", {
  variants: {
    variant: {
      neutral: "bg-layer-1 text-secondary ring ring-subtle ring-inset [&>svg]:text-tertiary",
      brand: "bg-accent-subtle-hover text-accent-primary ring ring-accent-subtle ring-inset",
      warning:
        "bg-warning-subtle text-warning-primary ring ring-warning-subtle ring-inset [&>svg]:text-warning-secondary",
      success:
        "bg-success-subtle-1 text-success-primary ring ring-success-subtle ring-inset [&>svg]:text-success-secondary",
      danger: "bg-danger-subtle text-danger-primary ring ring-danger-subtle ring-inset [&>svg]:text-danger-secondary",
    },
    size: {
      sm: "h-4 rounded-sm px-1 text-caption-sm-medium",
      base: "h-5 rounded-sm px-1.5 text-caption-sm-medium",
      lg: "h-6 rounded-md px-2 text-caption-md-medium",
    },
  },
  defaultVariants: {
    variant: "neutral",
    size: "base",
  },
});

export type BadgeProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "className"> &
  VariantProps<typeof badgeVariants> & {
    appendIcon?: React.ReactElement;
    /** Phosphor icon rendered filled before the label, so status reads without relying on color alone. */
    icon?: PhosphorIcon;
    prependIcon?: React.ReactElement;
  };

export type TBadgeVariant = NonNullable<BadgeProps["variant"]>;
export type TBadgeSize = NonNullable<BadgeProps["size"]>;

const badgeIconStyling: Record<TBadgeSize, string> = {
  sm: "size-3.5",
  base: "size-3.5",
  lg: "size-4",
};

export function getBadgeIconStyling(size: TBadgeSize): string {
  return badgeIconStyling[size];
}

export function getBadgeStyling(variant: TBadgeVariant, size: TBadgeSize): string {
  return badgeVariants({ variant, size });
}
