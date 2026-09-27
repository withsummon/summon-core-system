/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useId } from "react";
import type { ReactNode, RefObject, KeyboardEventHandler } from "react";
import { Command } from "cmdk";
import { CloseIcon, SearchIcon } from "@plane/propel/icons";
import { cn } from "@plane/utils";
export function CommandSearchView({
  containerRef,
  inputRef,
  isOpen,
  searchTerm,
  setSearchTerm,
  openPanel,
  handleMouseDown,
  handleFocus,
  handleKeyDown,
  handleClear,
  children,
  footer,
}: {
  containerRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement>;
  isOpen: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  openPanel: () => void;
  handleMouseDown: () => void;
  handleFocus: () => void;
  handleKeyDown: KeyboardEventHandler<HTMLInputElement>;
  handleClear: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const inputId = useId();
  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn("relative z-30 flex w-[364px] items-center transition-all duration-300 ease-in-out", {
          "w-[554px]": isOpen,
        })}
      >
        <label
          htmlFor={inputId}
          className={cn(
            "flex h-7 w-full items-center rounded-lg border border-subtle-1 bg-layer-2 p-2 transition-colors duration-200",
            {
              "bg-layer-1": isOpen,
            }
          )}
        >
          <SearchIcon className="mr-2 size-3.5 shrink-0 text-placeholder" />
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (!isOpen) openPanel();
            }}
            onMouseDown={handleMouseDown}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            className="placeholder-text-placeholder min-w-0 flex-1 bg-transparent text-13 text-primary outline-none"
          />
          {searchTerm && (
            <button type="button" aria-label="Clear command search" onClick={handleClear} className="ml-2 shrink-0">
              <CloseIcon className="size-3.5 text-placeholder hover:text-primary" />
            </button>
          )}
        </label>
      </div>
      <div
        className={cn(
          "shadow-lg absolute -top-[6px] left-1/2 z-20 flex -translate-x-1/2 flex-col overflow-hidden rounded-md border border-subtle bg-surface-1 px-0 pt-10 transition-all duration-300 ease-in-out",
          {
            "max-h-[80vh] w-[574px] opacity-100": isOpen,
            "h-0 w-0 opacity-0": !isOpen,
          }
        )}
      >
        {isOpen && (
          <Command
            filter={(i18nValue: string, search: string) => {
              if (i18nValue === "no-results") return 1;
              if (i18nValue.toLowerCase().includes(search.toLowerCase())) return 1;
              return 0;
            }}
            shouldFilter={searchTerm.length > 0}
            className="flex h-full w-full flex-col"
          >
            <Command.Input value={searchTerm} hidden />
            {/* We can skip the header input since we have the main input above,
                     but we might need the context indicator if we want that feature.
                     For now, let's just render the list. */}

            <Command.List className="vertical-scrollbar scrollbar-sm max-h-[60vh] overflow-y-auto px-2 pb-4 outline-none">
              {children}
            </Command.List>
            {footer}
          </Command>
        )}
      </div>
    </div>
  );
}
