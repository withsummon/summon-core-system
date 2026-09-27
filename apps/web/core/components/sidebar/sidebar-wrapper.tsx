/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
// plane helpers
import { useOutsideClickDetector } from "@plane/hooks";
import { PreferencesIcon } from "@plane/propel/icons";
import { SidebarContent } from "./sidebar-content";
// components
import { CustomizeNavigationDialog } from "@/components/navigation/customize-navigation-dialog";
// hooks
import { useAppTheme } from "@/hooks/store/use-app-theme";
// plane web components
import { WorkspaceEditionBadge } from "@/components/workspace/edition-badge";
import { AppSidebarToggleButton } from "./sidebar-toggle-button";
import { IconButton } from "@plane/propel/icon-button";

type TSidebarWrapperProps = {
  title: string;
  children: React.ReactNode;
  quickActions?: React.ReactNode;
  showEditionBadge?: boolean;
};

export const SidebarWrapper = observer(function SidebarWrapper(props: TSidebarWrapperProps) {
  const { title, children, quickActions, showEditionBadge = true } = props;
  // state
  const [isCustomizeNavDialogOpen, setIsCustomizeNavDialogOpen] = useState(false);
  // store hooks
  const { toggleSidebar, sidebarCollapsed } = useAppTheme();
  // refs
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClickDetector(ref, () => {
    if (sidebarCollapsed === false && window.innerWidth < 768) {
      toggleSidebar(true);
    }
  });

  return (
    <>
      <CustomizeNavigationDialog isOpen={isCustomizeNavDialogOpen} onClose={() => setIsCustomizeNavDialogOpen(false)} />
      <SidebarContent
        title={title}
        quickActions={quickActions}
        containerRef={ref}
        actions={
          <>
            {title === "Projects" && (
              <IconButton
                size="base"
                variant="ghost"
                icon={PreferencesIcon}
                onClick={() => setIsCustomizeNavDialogOpen(true)}
              />
            )}
            <AppSidebarToggleButton />
          </>
        }
        footer={
          showEditionBadge && (
            <div className="flex h-12 items-center justify-between border-t border-subtle bg-surface-1 p-3">
              <WorkspaceEditionBadge />
            </div>
          )
        }
      >
        {children}
      </SidebarContent>
    </>
  );
});
