/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type React from "react";
// plane imports
import { cn } from "@plane/utils";
// local imports
import type { TCustomImageAlignment } from "../types";

type Props = {
  alignment: TCustomImageAlignment;
  isResizing: boolean;
  onResizeStart: (e: React.MouseEvent | React.TouchEvent) => void;
};

export function ImageResizeHandles(props: Props) {
  const { alignment, isResizing, onResizeStart } = props;

  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-md border-2 border-accent-strong transition-opacity duration-100 ease-in-out",
          {
            "opacity-100": isResizing,
            "opacity-0 group-hover/image-component:opacity-100": !isResizing,
          }
        )}
      />
      {/* Pointer-only resize grip with no keyboard equivalent, so it stays out of the accessibility tree. */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute bottom-0 size-4 translate-y-1/2 rounded-full border-2 border-white bg-accent-primary transition-opacity duration-100 ease-in-out",
          {
            "pointer-events-auto opacity-100": isResizing,
            "pointer-events-none opacity-0 group-hover/image-component:pointer-events-auto group-hover/image-component:opacity-100":
              !isResizing,
            "left-0 -translate-x-1/2 cursor-nesw-resize": alignment === "right",
            "right-0 translate-x-1/2 cursor-nwse-resize": alignment !== "right",
          }
        )}
        onMouseDown={onResizeStart}
        onTouchStart={onResizeStart}
      />
    </>
  );
}
