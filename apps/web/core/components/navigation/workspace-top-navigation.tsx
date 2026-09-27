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
      className={cn("z-[27] flex min-h-10 w-full items-center bg-canvas px-3.5 transition-all duration-300", {
        "px-2": !showLabel,
      })}
    >
      <div className={cn("mr-1", !sidebarCollapsed && "md:hidden")}>{sidebarToggle}</div>
      {/* Workspace Menu */}
      <div className="flex-1 shrink-0">{workspaceMenu}</div>
      {/* Power K Search */}
      <div className="shrink-0">{powerK}</div>
      {/* Additional Actions */}
      <div className="flex flex-1 shrink-0 items-center justify-end gap-1">{actions}</div>
    </div>
  );
}
