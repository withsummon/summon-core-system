/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import type { ReactNode } from "react";
import { cn } from "@plane/utils";
export function WorkspaceTopNavigation({
  showLabel,
  sidebarCollapsed,
  sidebarToggle,
  workspaceMenu,
  powerK,
  actions,
}: {
  showLabel: boolean;
  sidebarCollapsed: boolean | undefined;
  sidebarToggle: ReactNode;
  workspaceMenu: ReactNode;
  powerK: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div
      className={cn(
        "z-[27] flex min-h-10 w-full flex-wrap items-center gap-y-1 bg-canvas px-3.5 py-1 transition-all duration-300 lg:flex-nowrap lg:gap-y-0 lg:py-0",
        {
          "px-2": !showLabel,
        }
      )}
    >
      <div className={cn("mr-1", !sidebarCollapsed && "md:hidden")}>{sidebarToggle}</div>
      {/* Workspace Menu */}
      <div className="min-w-0 flex-1 lg:shrink-0">{workspaceMenu}</div>
      {/* Power K Search */}
      <div className="order-last w-full shrink-0 lg:order-none lg:w-auto">{powerK}</div>
      {/* Additional Actions */}
      <div className="flex shrink-0 items-center justify-end gap-1 lg:flex-1">{actions}</div>
    </div>
  );
}
