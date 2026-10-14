/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Command } from "cmdk";
import { observer } from "mobx-react";
import { Dialog } from "@plane/propel/dialog";
// hooks
import { usePowerK } from "@/hooks/store/use-power-k";
// local imports
import type { TPowerKCommandConfig, TPowerKContext } from "../../core/types";
import type { TPowerKCommandsListProps } from "./commands-list";
import { PowerKModalFooter } from "./footer";
import { PowerKModalHeader } from "./header";
import { POWER_K_SEARCH_RESULT_VALUE_PREFIX } from "./search-results";

type Props = {
  commandsListComponent: React.FC<TPowerKCommandsListProps>;
  context: TPowerKContext;
  hideFooter?: boolean;
  isOpen: boolean;
  onClose: () => void;
};

export const ProjectsAppPowerKModalWrapper = observer(function ProjectsAppPowerKModalWrapper(props: Props) {
  const { commandsListComponent: CommandsListComponent, context, hideFooter = false, isOpen, onClose } = props;
  // states
  const [searchTerm, setSearchTerm] = useState("");
  const [isWorkspaceLevel, setIsWorkspaceLevel] = useState(false);
  // store hooks
  const { activePage, setActivePage } = usePowerK();

  // Handle command selection
  const handleCommandSelect = useCallback(
    (command: TPowerKCommandConfig) => {
      if (command.type === "action") {
        // Direct action - execute and potentially close
        command.action(context);
        if (command.closeOnSelect === true) {
          context.closePalette();
        }
      } else if (command.type === "change-page") {
        // Opens a selection page
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
      // Go back to main page
      if (context.activeCommand?.closeOnSelect === true) {
        context.closePalette();
      }
    },
    [context]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Cmd/Ctrl+K closes palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onClose();
        return;
      }

      // Escape closes palette or clears search
      if (e.key === "Escape") {
        e.preventDefault();
        if (searchTerm) {
          setSearchTerm("");
        } else {
          onClose();
        }
        return;
      }

      // Tab / Shift+Tab in the search field step through the list like ArrowDown / ArrowUp. Re-dispatching the
      // arrow key lets cmdk's own navigation (looping, disabled items, scroll into view) handle the move.
      if (
        e.key === "Tab" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.nativeEvent.isComposing &&
        e.target instanceof HTMLElement &&
        e.target.matches("[cmdk-input]")
      ) {
        e.preventDefault();
        e.target.dispatchEvent(
          new KeyboardEvent("keydown", { key: e.shiftKey ? "ArrowUp" : "ArrowDown", bubbles: true, cancelable: true })
        );
        return;
      }

      // Backspace clears context or goes back from page
      if (e.key === "Backspace" && !searchTerm) {
        e.preventDefault();
        if (activePage) {
          // Go back from selection page
          setActivePage(null);
          context.setActiveCommand(null);
        } else {
          // Hide context based actions
          context.setShouldShowContextBasedActions(false);
        }
        return;
      }
    },
    [searchTerm, activePage, onClose, setActivePage, context]
  );

  // Reset state when modal closes
  useEffect(() => {
    if (isOpen) return;
    const resetTimer = setTimeout(() => {
      setSearchTerm("");
      setActivePage(null);
      context.setActiveCommand(null);
      context.setShouldShowContextBasedActions(true);
    }, 200);
    return () => clearTimeout(resetTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {/* Top-anchored so the search field stays put while the results below it grow and shrink. */}
      <Dialog.Panel
        aria-label="Search commands"
        position="top"
        className="flex flex-col divide-y divide-subtle-1 md:top-[15vh]"
      >
        <Command
          filter={(i18nValue: string, search: string) => {
            if (i18nValue === "no-results" || i18nValue.startsWith(POWER_K_SEARCH_RESULT_VALUE_PREFIX)) return 1;
            if (i18nValue.toLowerCase().includes(search.toLowerCase())) return 1;
            return 0;
          }}
          shouldFilter={searchTerm.length > 0}
          onKeyDown={handleKeyDown}
          className="w-full"
        >
          <PowerKModalHeader
            activePage={activePage}
            context={context}
            onSearchChange={setSearchTerm}
            searchTerm={searchTerm}
          />
          {/* cmdk measures its sizer into --cmdk-list-height, so the list eases to each new height. flow-root
              keeps child margins inside the sizer; otherwise the measurement comes up short and clips the last row. */}
          <Command.List className="vertical-scrollbar scrollbar-sm h-[min(var(--cmdk-list-height),24rem)] overflow-x-hidden overflow-y-auto transition-[height] duration-200 ease-spring-sheet outline-none motion-reduce:transition-none [&>[cmdk-list-sizer]]:flow-root">
            <CommandsListComponent
              activePage={activePage}
              context={context}
              handleCommandSelect={handleCommandSelect}
              handlePageDataSelection={handlePageDataSelection}
              isWorkspaceLevel={isWorkspaceLevel}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          </Command.List>
          {/* Footer hints */}
          {!hideFooter && (
            <PowerKModalFooter
              isWorkspaceLevel={isWorkspaceLevel}
              projectId={context.params.projectId?.toString()}
              onWorkspaceLevelChange={setIsWorkspaceLevel}
            />
          )}
        </Command>
      </Dialog.Panel>
    </Dialog>
  );
});
