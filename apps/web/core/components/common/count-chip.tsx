/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

//
import { forwardRef } from "react";
import { cn } from "@plane/utils";

type TCountChip = React.HTMLAttributes<HTMLDivElement> & {
  count: string | number;
};

// Forwards the ref and DOM props so tooltip and popover triggers can anchor to it.
export const CountChip = forwardRef<HTMLDivElement, TCountChip>(function CountChip(
  { count, className = "", ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      {...rest}
      className={cn(
        "relative flex flex-shrink-0 items-center justify-center rounded-xl bg-accent-primary/20 px-2.5 py-0.5 text-caption-sm-semibold text-accent-primary",
        className
      )}
    >
      {count}
    </div>
  );
});
