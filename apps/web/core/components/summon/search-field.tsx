/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { forwardRef } from "react";
import type { ReactNode } from "react";
// The one place a Summon page draws a search field; lint keeps the icon import here.
// oxlint-disable-next-line no-restricted-imports
import { Search } from "lucide-react";
import { Input } from "@plane/propel/input";
import { cn } from "@plane/utils";

type Props = {
  /** Accessible name; also the placeholder unless one is given. */
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** `base` (32px) sits in tab bars and toolbars; `lg` (36px) matches page-header buttons. */
  size?: "base" | "lg";
  /** Width and placement of the field. */
  className?: string;
  id?: string;
  /** Hint inside the right edge, such as a shortcut. */
  trailing?: ReactNode;
};

/** Search field for Summon pages: icon, input and accessible name in one shape, so every page searches alike. */
export const SummonSearchField = forwardRef<HTMLInputElement, Props>(function SummonSearchField(
  { label, value, onValueChange, placeholder, size = "lg", className, id, trailing },
  ref
) {
  return (
    <div role="search" className={cn("relative min-w-0", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tertiary"
      />
      <Input
        ref={ref}
        id={id}
        type="search"
        autoComplete="off"
        aria-label={label}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder ?? label}
        className={cn("w-full pl-9 text-base sm:text-13", size === "base" ? "h-8" : "h-9", trailing ? "pr-12" : "pr-3")}
      />
      {trailing ? <span className="absolute top-1/2 right-2 -translate-y-1/2">{trailing}</span> : null}
    </div>
  );
});
