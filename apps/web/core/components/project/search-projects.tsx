/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { observer } from "mobx-react";
// plane hooks
import { useOutsideClickDetector } from "@plane/hooks";
// i18n
import { useTranslation } from "@plane/i18n";
import { SearchIcon, CloseIcon } from "@plane/propel/icons";
// helpers
import { cn } from "@plane/utils";
// hooks
import { useProjectFilter } from "@/hooks/store/use-project-filter";
import { IconButton } from "@plane/propel/icon-button";

export const ProjectSearch = observer(function ProjectSearch() {
  const { searchQuery, updateSearchQuery } = useProjectFilter();
  return <ProjectSearchView value={searchQuery} onChange={updateSearchQuery} />;
});

export function ProjectSearchView({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  // i18n
  const { t } = useTranslation();
  // hooks
  // refs
  const inputRef = useRef<HTMLInputElement>(null);
  // states
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // outside click detector hook
  useOutsideClickDetector(inputRef, () => {
    if (isSearchOpen && value.trim() === "") setIsSearchOpen(false);
  });

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (value.trim() !== "") onChange("");
      else setIsSearchOpen(false);
    }
  };

  return (
    <div className="flex items-center">
      {!isSearchOpen && (
        <IconButton
          variant="ghost"
          size="lg"
          className="-mr-1"
          onClick={() => {
            setIsSearchOpen(true);
            inputRef.current?.focus();
          }}
          icon={SearchIcon}
          aria-label={t("common.search.label")}
        />
      )}
      <div
        className={cn(
          "ml-auto flex w-0 items-center justify-start gap-1 overflow-hidden rounded-md border border-transparent bg-surface-1 text-placeholder opacity-0 transition-[width] ease-linear",
          {
            "w-30 border-subtle px-2.5 py-1.5 opacity-100 md:w-64": isSearchOpen,
          }
        )}
      >
        <SearchIcon className="h-3.5 w-3.5" />
        <input
          ref={inputRef}
          className="w-full max-w-[234px] border-none bg-transparent text-13 text-primary placeholder:text-placeholder focus:outline-none"
          placeholder={t("common.search.label")}
          aria-label={t("common.search.label")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
        />
        {isSearchOpen && (
          <button
            type="button"
            className="grid place-items-center"
            onClick={() => {
              onChange("");
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
