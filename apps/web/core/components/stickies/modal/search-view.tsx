/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { useOutsideClickDetector } from "@plane/hooks";
import { useTranslation } from "@plane/i18n";
import { SearchIcon, CloseIcon } from "@plane/propel/icons";
import { IconButton } from "@plane/propel/icon-button";
import { cn } from "@plane/utils";
export function StickySearchView({
  searchQuery,
  updateSearchQuery,
}: {
  searchQuery: string;
  updateSearchQuery: (value: string) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  useOutsideClickDetector(inputRef, () => {
    if (isSearchOpen && searchQuery.trim() === "") setIsSearchOpen(false);
  });
  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape") return;
    if (searchQuery.trim()) updateSearchQuery("");
    else setIsSearchOpen(false);
  };
  return (
    <div className="my-auto mr-2 flex items-center">
      {!isSearchOpen && (
        <IconButton
          variant="ghost"
          size="lg"
          className="-mr-2"
          icon={SearchIcon}
          onClick={() => {
            setIsSearchOpen(true);
            inputRef.current?.focus();
          }}
        />
      )}
      <div
        className={cn(
          "ml-auto flex w-0 items-center justify-start gap-1 overflow-hidden rounded-md border border-transparent text-placeholder opacity-0 transition-[width] ease-linear",
          {
            "w-30 border-subtle px-2.5 py-1.5 opacity-100 md:w-64": isSearchOpen,
          }
        )}
      >
        <SearchIcon className="size-3.5 shrink-0" />
        <input
          ref={inputRef}
          className="w-full max-w-[234px] border-none bg-transparent text-13 text-primary placeholder:text-placeholder focus:outline-none"
          aria-label="Search stickies"
          placeholder={t("stickies.search_placeholder")}
          value={searchQuery}
          onChange={(e) => {
            updateSearchQuery(e.target.value);
          }}
          onKeyDown={handleInputKeyDown}
        />
        {isSearchOpen && (
          <button
            type="button"
            className="grid place-items-center"
            onClick={() => {
              updateSearchQuery("");
              setIsSearchOpen(false);
            }}
          >
            <CloseIcon className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
