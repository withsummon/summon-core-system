/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { forwardRef } from "react";
import type { FocusEvent, HTMLAttributes, MouseEvent, SyntheticEvent } from "react";
import { cn } from "@plane/utils";
import { emptySlotClassName } from "./empty-slot";

/** Keeps a click or focus on a property control from reaching the work item row or card around it. */
const stopPropertyEvent = (e: SyntheticEvent<HTMLElement>) => {
  e.stopPropagation();
  e.preventDefault();
};

type TPropertySlotProps = HTMLAttributes<HTMLDivElement> & {
  /** With `layout`, an unset property follows the quiet empty-slot rules (see empty-slot.ts). */
  layout?: string;
  isEmpty?: boolean;
};

/** Wraps one work item property control so using it never opens the work item. */
export const PropertySlot = forwardRef<HTMLDivElement, TPropertySlotProps>(function PropertySlot(props, ref) {
  const { className = "h-5", layout, isEmpty = false, onClick, onFocus, ...rest } = props;
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    stopPropertyEvent(e);
    onClick?.(e);
  };
  const handleFocus = (e: FocusEvent<HTMLDivElement>) => {
    stopPropertyEvent(e);
    onFocus?.(e);
  };
  // A presentational wrapper: the control inside is the interactive element, this only stops its events.
  return (
    <div
      role="presentation"
      ref={ref}
      {...rest}
      className={cn(className, layout !== undefined && isEmpty && emptySlotClassName(layout))}
      onClick={handleClick}
      onFocus={handleFocus}
    />
  );
});
