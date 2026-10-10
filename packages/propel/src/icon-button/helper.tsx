/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type React from "react";

export const iconButtonVariants = cva(
  "inline-flex aspect-square press items-center justify-center gap-1 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary:
          "bg-accent-primary text-on-color shadow-tactile-accent hover:bg-accent-primary-hover focus:bg-accent-primary-active active:bg-accent-primary-active disabled:bg-layer-disabled disabled:text-on-color-disabled",
        "error-fill":
          "bg-danger-primary text-on-color shadow-tactile-accent hover:bg-danger-primary-hover focus:bg-danger-primary-active active:bg-danger-primary-active disabled:bg-layer-disabled disabled:text-disabled",
        "error-outline":
          "border border-danger-strong bg-layer-2 text-danger-primary hover:bg-danger-subtle focus:bg-danger-subtle-hover active:bg-danger-subtle-hover disabled:border-subtle-1 disabled:bg-layer-2 disabled:text-disabled",
        secondary:
          "border border-subtle bg-layer-2 text-secondary shadow-tactile hover:bg-layer-2-hover hover:text-primary focus:bg-layer-2-active active:bg-layer-2-active disabled:border-subtle-1 disabled:bg-layer-transparent disabled:text-disabled",
        tertiary:
          "bg-layer-3 text-secondary hover:bg-layer-3-hover focus:bg-layer-3-active active:bg-layer-3-active disabled:bg-layer-transparent disabled:text-disabled",
        ghost:
          "bg-layer-transparent text-secondary hover:bg-layer-transparent-hover focus:bg-layer-transparent-active active:bg-layer-transparent-active disabled:bg-layer-transparent disabled:text-disabled",
      },
      size: {
        sm: "size-7 rounded-md",
        base: "size-8 rounded-lg",
        lg: "size-9 rounded-lg",
        xl: "size-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "base",
    },
  }
);

type IconButtonPropsWithChildren = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof iconButtonVariants> & {
    icon: React.FC<{ className?: string }>;
    loading?: boolean;
    iconClassName?: string;
  };
export type IconButtonProps = Omit<IconButtonPropsWithChildren, "children">;

export function getIconButtonStyling(
  variant: NonNullable<IconButtonProps["variant"]>,
  size: NonNullable<IconButtonProps["size"]>
): string {
  return iconButtonVariants({ variant, size });
}
