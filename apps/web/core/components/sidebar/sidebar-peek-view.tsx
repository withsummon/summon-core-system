/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactElement, ReactNode } from "react";
import { cn } from "@plane/utils";

interface SidebarPeekViewProps {
  width: number;
  showPeek: boolean;
  isPeekVisible: boolean;
  isResizing: boolean;
  isAnyExtendedSidebarExpanded: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  resizeHandle: ReactElement;
  children?: ReactNode;
}

export function SidebarPeekView({
  width,
  showPeek,
  isPeekVisible,
  isResizing,
  isAnyExtendedSidebarExpanded,
  onMouseEnter,
  onMouseLeave,
  resizeHandle,
  children,
}: SidebarPeekViewProps) {
  return (
    <aside
      className={cn(
        "absolute left-0 z-20 h-full bg-surface-1 shadow-sm",
        !isResizing && "transition-[translate,opacity,visibility] duration-300 ease-in-out",
        isPeekVisible ? "visible translate-x-0 opacity-100" : "invisible translate-x-[-100%] opacity-0",
        "pointer-events-none",
        isPeekVisible && "pointer-events-auto",
        !showPeek ? "w-0" : "w-full"
      )}
      style={{
        width: `${width}px`,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label="Sidebar peek view"
    >
      <div
        className={cn(
          "group/sidebar relative z-20 flex h-full w-full flex-col overflow-hidden bg-surface-1 pt-4",
          "self-center rounded-md rounded-tl-none rounded-bl-none border-r border-subtle",
          isAnyExtendedSidebarExpanded && "rounded-none"
        )}
      >
        {children}
        {resizeHandle}
      </div>
    </aside>
  );
}
