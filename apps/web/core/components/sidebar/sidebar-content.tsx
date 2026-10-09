/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */
import type { ReactNode, Ref } from "react";
import { ScrollArea } from "@plane/propel/scrollarea";
export function SidebarContent({
  title,
  children,
  quickActions,
  actions,
  footer,
  containerRef,
}: {
  title: string;
  children: ReactNode;
  quickActions?: ReactNode;
  actions: ReactNode;
  footer?: ReactNode;
  containerRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={containerRef} className="flex h-full w-full animate-fade-in flex-col">
      <div className="flex flex-col gap-3 px-3">
        {/* Workspace switcher and settings */}

        <div className="flex items-center justify-between gap-2 px-2">
          <span className="pt-1 text-16 font-medium text-primary">{title}</span>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
        {/* Quick actions */}
        {quickActions}
      </div>

      <ScrollArea
        orientation="vertical"
        scrollType="hover"
        size="sm"
        rootClassName="size-full overflow-x-hidden overflow-y-auto"
        viewportClassName="flex flex-col gap-3 overflow-x-hidden h-full w-full overflow-y-auto px-3 pt-3 pb-0.5"
      >
        {children}
      </ScrollArea>
      {/* Help Section */}
      {footer}
    </div>
  );
}
