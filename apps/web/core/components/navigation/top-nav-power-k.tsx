/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { CommandSearchView } from "./command-search-view";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// hooks
// power-k
import type { TPowerKCommandConfig, TPowerKContext } from "@/components/power-k/core/types";
import { ProjectsAppPowerKCommandsList } from "@/components/power-k/ui/modal/commands-list";
import { PowerKModalFooter } from "@/components/power-k/ui/modal/footer";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { usePowerK } from "@/hooks/store/use-power-k";
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { useExpandableSearch } from "@/hooks/use-expandable-search";

export const TopNavPowerK = observer(() => {
  // router
  const router = useAppRouter();
  const params = useParams();
  const { projectId: routerProjectId, workItem: workItemIdentifier } = params;

  // states
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCommand, setActiveCommand] = useState<TPowerKCommandConfig | null>(null);
  const [shouldShowContextBasedActions, setShouldShowContextBasedActions] = useState(true);
  const [isWorkspaceLevel, setIsWorkspaceLevel] = useState(false);

  // store hooks
  const { activeContext, setActivePage, activePage, setTopNavInputRef } = usePowerK();
  const { data: currentUser } = useUser();

  const handleOnClose = useCallback(() => {
    setSearchTerm("");
    setActivePage(null);
    setActiveCommand(null);
  }, [setSearchTerm, setActivePage, setActiveCommand]);

  // expandable search hook
  const {
    isOpen,
    containerRef,
    inputRef,
    handleClose: closePanel,
    handleMouseDown,
    handleFocus,
    openPanel,
  } = useExpandableSearch({
    onClose: handleOnClose,
  });

  // derived values
  const {
    issue: { getIssueById, getIssueIdByIdentifier },
  } = useIssueDetail();

  const workItemId = workItemIdentifier ? getIssueIdByIdentifier(workItemIdentifier.toString()) : undefined;
  const workItemDetails = workItemId ? getIssueById(workItemId) : undefined;
  const projectId: string | string[] | undefined | null = routerProjectId ?? workItemDetails?.project_id;

  // Build command context
  const context: TPowerKContext = useMemo(
    () => ({
      currentUserId: currentUser?.id,
      activeCommand,
      activeContext,
      shouldShowContextBasedActions,
      setShouldShowContextBasedActions,
      params: {
        ...params,
        projectId,
      },
      router,
      closePalette: closePanel,
      setActiveCommand,
      setActivePage,
    }),
    [
      currentUser?.id,
      activeCommand,
      activeContext,
      shouldShowContextBasedActions,
      params,
      projectId,
      router,
      setActivePage,
      closePanel,
    ]
  );

  // Register input ref with PowerK store for keyboard shortcut access
  useEffect(() => {
    setTopNavInputRef(inputRef);
    return () => {
      setTopNavInputRef(null);
    };
  }, [setTopNavInputRef]);

  const handleClear = () => {
    setSearchTerm("");
    inputRef.current?.focus();
  };

  // Handle command selection
  const handleCommandSelect = useCallback(
    (command: TPowerKCommandConfig) => {
      if (command.type === "action") {
        command.action(context);
        // Always close on command selection
        context.closePalette();
      } else if (command.type === "change-page") {
        context.setActiveCommand(command);
        setActivePage(command.page);
        setSearchTerm("");
      }
    },
    [context, setActivePage]
  );

  // Handle selection page item selection
  const handlePageDataSelection = useCallback(
    (data: unknown) => {
      if (context.activeCommand?.type === "change-page") {
        context.activeCommand.onSelect(data, context);
      }
      // Always close on page data selection
      context.closePalette();
    },
    [context]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Cmd/Ctrl+K closes the search dropdown
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        closePanel();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (searchTerm) {
          setSearchTerm("");
        }
        closePanel();
        return;
      }

      if (e.key === "Backspace" && !searchTerm) {
        if (activePage) {
          e.preventDefault();
          setActivePage(null);
          context.setActiveCommand(null);
        } else if (shouldShowContextBasedActions) {
          // Optional: logic to hide context actions if desired, similar to wrapper
          context.setShouldShowContextBasedActions(false);
        }
        return;
      }

      // Arrow down/up keys to navigate command items
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && isOpen) {
        e.preventDefault();
        // Get the Command.List element
        const commandList = containerRef.current?.querySelector("[cmdk-list]") as HTMLElement;
        if (commandList) {
          // Create and dispatch a keyboard event on the list to trigger cmdk navigation
          const syntheticEvent = new KeyboardEvent("keydown", {
            key: e.key,
            bubbles: true,
            cancelable: true,
          });
          commandList.dispatchEvent(syntheticEvent);

          // Also try to focus the first/selected item
          if (e.key === "ArrowDown") {
            const firstItem = commandList.querySelector('[cmdk-item]:not([aria-disabled="true"])') as HTMLElement;
            if (firstItem) {
              firstItem.focus();
            }
          }
        }
        return;
      }

      // Enter key to execute selected command
      if (e.key === "Enter" && isOpen) {
        e.preventDefault();
        // Find the currently selected/focused item
        const selectedItem = containerRef.current?.querySelector('[cmdk-item][aria-selected="true"]') as HTMLElement;
        if (selectedItem) {
          // Trigger click on the selected item
          selectedItem.click();
        }
        return;
      }
    },
    [searchTerm, activePage, context, shouldShowContextBasedActions, setActivePage, closePanel]
  );

  return (
    <CommandSearchView
      containerRef={containerRef}
      inputRef={inputRef}
      isOpen={isOpen}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      openPanel={openPanel}
      handleMouseDown={handleMouseDown}
      handleFocus={handleFocus}
      handleKeyDown={handleKeyDown}
      handleClear={handleClear}
      footer={
        <PowerKModalFooter
          isWorkspaceLevel={isWorkspaceLevel}
          projectId={context.params.projectId?.toString()}
          onWorkspaceLevelChange={setIsWorkspaceLevel}
        />
      }
    >
      <ProjectsAppPowerKCommandsList
        activePage={activePage}
        context={context}
        handleCommandSelect={handleCommandSelect}
        handlePageDataSelection={handlePageDataSelection}
        isWorkspaceLevel={isWorkspaceLevel}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        handleSearchMenuClose={() => closePanel()}
      />
    </CommandSearchView>
  );
});
