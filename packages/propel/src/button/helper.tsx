/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex press items-center justify-center gap-1.5 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:pointer-events-none [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-accent-primary text-on-color shadow-tactile-accent hover:bg-accent-primary-hover active:bg-accent-primary-active disabled:bg-layer-disabled disabled:text-on-color-disabled disabled:shadow-none",
        "error-fill":
          "bg-danger-primary text-on-color shadow-tactile-accent hover:bg-danger-primary-hover active:bg-danger-primary-active disabled:bg-layer-disabled disabled:text-disabled disabled:shadow-none",
        "error-outline":
          "border border-danger-strong bg-layer-2 text-danger-secondary hover:bg-danger-subtle active:bg-danger-subtle-hover disabled:border-subtle-1 disabled:bg-layer-2 disabled:text-disabled",
        secondary:
          "border border-subtle bg-layer-2 text-primary shadow-tactile hover:bg-layer-2-hover active:bg-layer-2-active disabled:border-subtle-1 disabled:bg-layer-transparent disabled:text-disabled disabled:shadow-none",
        tertiary:
          "bg-layer-3 text-secondary hover:bg-layer-3-hover active:bg-layer-3-active disabled:bg-layer-transparent disabled:text-disabled",
        ghost:
          "bg-layer-transparent text-secondary hover:bg-layer-transparent-hover focus:bg-layer-transparent-active active:bg-layer-transparent-active disabled:bg-layer-transparent disabled:text-disabled",
        link: "px-0 text-link-primary underline hover:text-link-primary-hover focus:text-link-primary-hover active:text-link-primary-hover disabled:text-disabled",
      },
      size: {
        sm: "h-7 rounded-lg px-2 text-12 leading-none font-medium",
        base: "h-8 rounded-lg px-3 text-13 leading-none font-medium",
        lg: "h-9 rounded-lg px-3 text-13 leading-none font-medium",
        xl: "h-10 rounded-lg px-4 text-14 leading-none font-medium",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "base",
    },
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    appendIcon?: React.ReactElement;
    loading?: boolean;
    prependIcon?: React.ReactElement;
  };

export type TButtonVariant = NonNullable<ButtonProps["variant"]>;
export type TButtonSize = NonNullable<ButtonProps["size"]>;

const buttonIconStyling: Record<TButtonSize, string> = {
  sm: "size-3.5",
  base: "size-3.5",
  lg: "size-4",
  xl: "size-4 ",
};

export function getIconStyling(size: TButtonSize): string {
  return buttonIconStyling[size];
}

export function getButtonStyling(variant: TButtonVariant, size: TButtonSize): string {
  return buttonVariants({ variant, size });
}
