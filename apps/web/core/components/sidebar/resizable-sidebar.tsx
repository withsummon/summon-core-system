/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Dispatch, ReactElement, SetStateAction } from "react";
import { useCallback, useEffect } from "react";
import { cn } from "@plane/utils";
// local imports
import { SidebarPeekView } from "./sidebar-peek-view";
import { SidebarResizeHandle } from "./sidebar-resize-handle";
import { useSidebarPeekTimer, useSidebarResize } from "./use-sidebar-resize";

interface ResizableSidebarProps {
  showPeek?: boolean;
  togglePeek: (value?: boolean) => void;
  isCollapsed?: boolean;
  width: number;
  setWidth: Dispatch<SetStateAction<number>>;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  defaultCollapsed?: boolean;
  peekDuration?: number;
  toggleCollapsed: (value?: boolean) => void;
  onWidthChange?: (width: number) => void;
  className?: string;
  children?: ReactElement;
  extendedSidebar?: ReactElement;
  isAnyExtendedSidebarExpanded?: boolean;
  isAnySidebarDropdownOpen?: boolean;
}

export function ResizableSidebar({
  showPeek = false,
  togglePeek,
  peekDuration = 500,
  isCollapsed = false,
  toggleCollapsed: toggleCollapsedProp,
  width,
  setWidth,
  onWidthChange,
  minWidth = 236,
  maxWidth = 350,
  className = "",
  children,
  extendedSidebar,
  isAnyExtendedSidebarExpanded = false,
  isAnySidebarDropdownOpen = false,
}: ResizableSidebarProps) {
  const { isResizing, startResizing, handleResizeKeyDown } = useSidebarResize({ width, setWidth, minWidth, maxWidth });
  const { handlePeekEnter, handlePeekLeave, clearPeekTimeout } = useSidebarPeekTimer({
    isCollapsed,
    showPeek,
    peekDuration,
    togglePeek,
    isAnyExtendedSidebarExpanded,
    isAnySidebarDropdownOpen,
  });
  const isPeekVisible = isCollapsed && showPeek;

  const toggleCollapsed = useCallback(() => {
    toggleCollapsedProp();
    togglePeek(false);
    clearPeekTimeout();
  }, [toggleCollapsedProp, togglePeek, clearPeekTimeout]);

  // Call external handlers when state changes
  useEffect(() => {
    onWidthChange?.(width);
  }, [width, onWidthChange]);

  const resizeHandleProps = {
    width,
    minWidth,
    maxWidth,
    onDoubleClick: toggleCollapsed,
    onMouseDown: startResizing,
    onKeyDown: handleResizeKeyDown,
  };

  return (
    <>
      {!isCollapsed && (
        <button
          type="button"
          className="absolute inset-0 z-[19] bg-backdrop md:hidden"
          aria-label="Close sidebar"
          onClick={toggleCollapsed}
        />
      )}
      {/* Main Sidebar */}
      <aside
        id="main-sidebar"
        className={cn(
          "z-20 h-full border-r border-subtle bg-surface-1",
          !isResizing && "transition-[width,min-width,max-width,translate,opacity,visibility] duration-300 ease-in-out",
          isCollapsed ? "invisible w-0 translate-x-[-100%] opacity-0" : "visible translate-x-0 opacity-100",
          "max-md:absolute",
          className
        )}
        style={{
          width: `${isCollapsed ? 0 : width}px`,
          minWidth: `${isCollapsed ? 0 : width}px`,
          maxWidth: `${isCollapsed ? 0 : width}px`,
        }}
        aria-label="Main sidebar"
      >
        <div
          className={cn(
            "group/sidebar relative flex h-full w-full flex-col overflow-hidden bg-surface-1 pt-3",
            isAnyExtendedSidebarExpanded && "rounded-none"
          )}
        >
          {children}

          <SidebarResizeHandle
            {...resizeHandleProps}
            className={cn(
              "transition-[width,background-color] duration-200",
              isResizing ? "w-1.5 bg-layer-1" : "hover:bg-surface-2"
            )}
          />
        </div>
      </aside>
      {/* Peek View */}
      <SidebarPeekView
        width={width}
        showPeek={showPeek}
        isPeekVisible={isPeekVisible}
        isResizing={isResizing}
        isAnyExtendedSidebarExpanded={isAnyExtendedSidebarExpanded}
        onMouseEnter={handlePeekEnter}
        onMouseLeave={handlePeekLeave}
        resizeHandle={
          <SidebarResizeHandle
            {...resizeHandleProps}
            className={cn("transition-colors duration-200", isResizing ? "bg-layer-1" : "hover:bg-surface-2")}
          />
        }
      >
        {children}
      </SidebarPeekView>

      {/* Extended Sidebar */}
      {extendedSidebar}
    </>
  );
}
