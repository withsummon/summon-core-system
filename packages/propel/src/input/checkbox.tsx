/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import * as React from "react";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "../utils";

export type CheckboxProps = React.ComponentProps<typeof BaseCheckbox.Root> & {
  containerClassName?: string;
  iconClassName?: string;
};

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { className, containerClassName, iconClassName, indeterminate, ...props },
  ref
) {
  return (
    <span className={cn("inline-flex shrink-0", containerClassName)}>
      <BaseCheckbox.Root
        ref={ref}
        indeterminate={indeterminate}
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded border border-strong bg-transparent text-on-color outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent-strong data-[checked]:border-accent-strong data-[checked]:bg-accent-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[indeterminate]:border-accent-strong data-[indeterminate]:bg-accent-primary",
          className
        )}
        {...props}
      >
        <BaseCheckbox.Indicator className="grid place-items-center">
          {indeterminate ? (
            <Minus aria-hidden="true" className={cn("size-3", iconClassName)} />
          ) : (
            <Check aria-hidden="true" className={cn("size-3", iconClassName)} />
          )}
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
    </span>
  );
});
