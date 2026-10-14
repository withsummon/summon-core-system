/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { EXTENDED_SIDEBAR_WIDTH, SIDEBAR_WIDTH } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
import { cn } from "@plane/utils";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
// hooks
import useExtendedSidebarOutsideClickDetector from "@/hooks/use-extended-sidebar-overview-outside-click";

type Props = {
  className?: string;
  children: React.ReactNode;
  extendedSidebarRef: React.RefObject<HTMLDivElement>;
  isExtendedSidebarOpened: boolean;
  handleClose: () => void;
  excludedElementId: string;
};

export const ExtendedSidebarWrapper = observer(function ExtendedSidebarWrapper(props: Props) {
  const { className, children, extendedSidebarRef, isExtendedSidebarOpened, handleClose, excludedElementId } = props;
  // store hooks
  const { sidebarCollapsed } = useAppTheme();
  // local storage
  const { storedValue } = useLocalStorage("sidebarWidth", SIDEBAR_WIDTH);
  // Contents mount on first open and then stay, so closing still animates and an unopened panel
  // costs nothing when the route changes.
  const [hasOpened, setHasOpened] = useState(isExtendedSidebarOpened);
  if (isExtendedSidebarOpened && !hasOpened) setHasOpened(true);

  // The panel stays mounted so it can animate out; outside clicks only matter while it is open.
  const closeIfOpen = useCallback(() => {
    if (isExtendedSidebarOpened) handleClose();
  }, [isExtendedSidebarOpened, handleClose]);
  useExtendedSidebarOutsideClickDetector(extendedSidebarRef, closeIfOpen, excludedElementId);

  useEffect(() => {
    if (sidebarCollapsed) {
      handleClose();
    }
  }, [sidebarCollapsed, handleClose]);

  return (
    <div
      id={excludedElementId}
      ref={extendedSidebarRef}
      className={cn(
        // Slides out from under the main sidebar; exits faster and softer than it enters.
        "absolute z-[21] flex h-full flex-col border-r border-subtle bg-surface-1 p-4 py-2 shadow-raised-200 transition-[translate,opacity,visibility] motion-reduce:transition-none",
        isExtendedSidebarOpened
          ? "visible translate-x-0 opacity-100 duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
          : "pointer-events-none invisible -translate-x-3 opacity-0 duration-200 ease-[cubic-bezier(0.4,0,1,1)]",
        className
      )}
      style={{
        left: `${storedValue ?? SIDEBAR_WIDTH}px`,
        width: `${EXTENDED_SIDEBAR_WIDTH}px`,
      }}
    >
      {hasOpened && children}
    </div>
  );
});
