/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { KeyboardEvent, MouseEvent } from "react";
import { cn } from "@plane/utils";

interface SidebarResizeHandleProps {
  className: string;
  width: number;
  minWidth: number;
  maxWidth: number;
  onDoubleClick: () => void;
  onMouseDown: (e: MouseEvent) => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

export function SidebarResizeHandle({
  className,
  width,
  minWidth,
  maxWidth,
  onDoubleClick,
  onMouseDown,
  onKeyDown,
}: SidebarResizeHandleProps) {
  return (
    <div
      className={cn("absolute top-0 right-0 z-[20] h-full w-1 cursor-ew-resize", className)}
      // onDoubleClick toggle sidebar
      onDoubleClick={onDoubleClick}
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-label="Resize sidebar"
    />
  );
}
