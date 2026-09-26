/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { Dialog } from "@plane/propel/dialog";
// plane imports
import { CloseIcon, SearchIcon } from "@plane/propel/icons";
import { ScrollArea } from "@plane/propel/scrollarea";
import { Input } from "@plane/ui";
// hooks
import { usePowerK } from "@/hooks/store/use-power-k";
// local imports
import { ShortcutRenderer } from "../renderer/shortcut";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function ShortcutsModal(props: Props) {
  const { isOpen, onClose } = props;
  // states
  const [query, setQuery] = useState("");
  // store hooks
  const { commandRegistry } = usePowerK();

  // Get all commands from registry
  const allCommandsWithShortcuts = commandRegistry.getAllCommandsWithShortcuts();

  const handleClose = () => {
    onClose();
    setQuery("");
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Dialog.Panel className="sm:max-w-md">
        <div className="flex h-[61vh] w-full flex-col space-y-4 overflow-hidden rounded-lg bg-surface-1 py-5 shadow-raised-200 transition-all sm:w-[28rem]">
          <Dialog.Title className="flex justify-between px-5">
            <span className="text-16 font-medium">Keyboard shortcuts</span>
            <button type="button" aria-label="Close shortcuts" onClick={handleClose}>
              <CloseIcon className="h-4 w-4 text-secondary hover:text-primary" aria-hidden="true" />
            </button>
          </Dialog.Title>
          <div className="px-5">
            <div className="flex w-full items-center rounded-sm border-[0.5px] border-subtle bg-surface-2 px-2">
              <SearchIcon className="h-3.5 w-3.5 text-secondary" />
              <Input
                aria-label="Search shortcuts"
                id="search"
                name="search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for shortcuts"
                className="w-full border-none bg-transparent py-1 text-11 text-secondary outline-none"
                autoFocus
              />
            </div>
          </div>

          <ScrollArea size="sm" rootClassName="overflow-y-scroll px-5">
            <ShortcutRenderer searchQuery={query} commands={allCommandsWithShortcuts} />
          </ScrollArea>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
