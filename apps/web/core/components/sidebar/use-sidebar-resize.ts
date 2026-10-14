/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Dispatch, KeyboardEvent, MouseEvent as ReactMouseEvent, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const KEYBOARD_RESIZE_STEP = 10;

interface UseSidebarResizeArgs {
  width: number;
  setWidth: Dispatch<SetStateAction<number>>;
  minWidth: number;
  maxWidth: number;
}

export function useSidebarResize({ width, setWidth, minWidth, maxWidth }: UseSidebarResizeArgs) {
  const [isResizing, setIsResizing] = useState(false);
  const initialWidthRef = useRef<number>(0);
  const initialMouseXRef = useRef<number>(0);

  const clampWidth = useCallback(
    (value: number) => Math.min(Math.max(value, minWidth), maxWidth),
    [minWidth, maxWidth]
  );

  const startResizing = useCallback(
    (e: ReactMouseEvent) => {
      setIsResizing(true);
      initialWidthRef.current = width;
      initialMouseXRef.current = e.clientX;
    },
    [width]
  );

  const handleResizeKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? KEYBOARD_RESIZE_STEP : -KEYBOARD_RESIZE_STEP;
      setWidth((current) => clampWidth(current + delta));
    },
    [clampWidth, setWidth]
  );

  // Track the pointer on the document while a drag is in progress
  useEffect(() => {
    if (!isResizing) return;

    const handleResize = (e: MouseEvent) => {
      setWidth(clampWidth(initialWidthRef.current + e.clientX - initialMouseXRef.current));
    };
    const stopResizing = () => setIsResizing(false);

    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", stopResizing);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleResize);
      document.removeEventListener("mouseup", stopResizing);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, clampWidth, setWidth]);

  return { isResizing, startResizing, handleResizeKeyDown };
}

interface UseSidebarPeekTimerArgs {
  isCollapsed: boolean;
  showPeek: boolean;
  peekDuration: number;
  togglePeek: (value?: boolean) => void;
  isAnyExtendedSidebarExpanded: boolean;
  isAnySidebarDropdownOpen: boolean;
}

export function useSidebarPeekTimer({
  isCollapsed,
  showPeek,
  peekDuration,
  togglePeek,
  isAnyExtendedSidebarExpanded,
  isAnySidebarDropdownOpen,
}: UseSidebarPeekTimerArgs) {
  const peekTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const clearPeekTimeout = useCallback(() => {
    if (peekTimeoutRef.current) clearTimeout(peekTimeoutRef.current);
    peekTimeoutRef.current = undefined;
  }, []);

  const handlePeekEnter = useCallback(() => {
    if (isCollapsed && showPeek) clearPeekTimeout();
  }, [isCollapsed, showPeek, clearPeekTimeout]);

  const handlePeekLeave = useCallback(() => {
    if (!isCollapsed || isAnyExtendedSidebarExpanded || isAnySidebarDropdownOpen) return;
    clearPeekTimeout();
    peekTimeoutRef.current = setTimeout(() => {
      peekTimeoutRef.current = undefined;
      togglePeek(false);
    }, peekDuration);
  }, [isCollapsed, isAnyExtendedSidebarExpanded, isAnySidebarDropdownOpen, clearPeekTimeout, togglePeek, peekDuration]);

  // Clear a pending timeout on unmount
  useEffect(() => clearPeekTimeout, [clearPeekTimeout]);

  return { handlePeekEnter, handlePeekLeave, clearPeekTimeout };
}
