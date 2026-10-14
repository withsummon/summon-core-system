/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
// plane imports
import { cn } from "@plane/utils";
import { AppRailRoot } from "@/components/navigation";
import { useAppRailVisibility } from "@/lib/app-rail";
import { TopNavigationRoot } from "@/components/navigation/top-navigation-root";

export const WorkspaceContentWrapper = observer(function WorkspaceContentWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use the context to determine if app rail should render
  const { shouldRenderAppRail } = useAppRailVisibility();

  return (
    <div className="relative flex size-full flex-col overflow-hidden bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-[100] focus-visible:rounded-md focus-visible:bg-surface-1 focus-visible:px-3 focus-visible:py-2 focus-visible:text-13 focus-visible:text-primary focus-visible:shadow-overlay-200"
      >
        Skip to content
      </a>
      <TopNavigationRoot />
      <div className="relative flex size-full overflow-hidden">
        {/* Conditionally render AppRailRoot based on context */}
        {shouldRenderAppRail && <AppRailRoot />}
        <div
          className={cn(
            "relative size-full flex-grow overflow-hidden pr-2 pb-2 pl-2 transition-[padding-left] duration-300 ease-in-out",
            {
              "pl-0!": shouldRenderAppRail,
            }
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
});
