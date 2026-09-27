/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import type { ReactNode } from "react";
import { cn } from "@plane/utils";
export function WorkspaceContentFrame({
  children,
  topNavigation,
  appRail,
  shouldRenderAppRail,
}: {
  children: ReactNode;
  topNavigation: ReactNode;
  appRail: ReactNode;
  shouldRenderAppRail: boolean;
}) {
  return (
    <div className="relative flex size-full flex-col overflow-hidden bg-canvas transition-all duration-300 ease-in-out">
      {topNavigation}
      <div className="relative flex size-full overflow-hidden">
        {/* Conditionally render AppRailRoot based on context */}
        {shouldRenderAppRail && appRail}
        <div
          className={cn(
            "relative size-full flex-grow overflow-hidden pr-2 pb-2 pl-2 transition-all duration-300 ease-in-out",
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
}
