/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
import { POPUP_SEARCH_CLASSNAME, POPUP_SEARCH_INPUT_CLASSNAME } from "@plane/propel/popover";
import React, { useEffect, useRef } from "react";
import { SearchIcon } from "@plane/propel/icons";
// helpers
import { cn } from "../../utils";

interface IInputSearch {
  isOpen: boolean;
  query: string;
  updateQuery: (query: string) => void;
  inputIcon?: React.ReactNode;
  inputContainerClassName?: string;
  inputClassName?: string;
  inputPlaceholder?: string;
  isMobile: boolean;
}

export function InputSearch(props: IInputSearch) {
  const { isOpen, query, updateQuery, inputIcon, inputContainerClassName, inputClassName, inputPlaceholder, isMobile } =
    props;

  const inputRef = useRef<HTMLInputElement | null>(null);

  const searchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (query !== "" && e.key === "Escape") {
      e.stopPropagation();
      updateQuery("");
    }
  };

  useEffect(() => {
    if (isOpen && !isMobile) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      inputRef.current && inputRef.current.focus();
    }
  }, [isOpen, isMobile]);

  return (
    <div className={cn(POPUP_SEARCH_CLASSNAME, inputContainerClassName)}>
      {inputIcon ? <>{inputIcon}</> : <SearchIcon className="size-3.5 flex-none" aria-hidden="true" />}
      <Combobox.Input
        ref={inputRef}
        className={cn(POPUP_SEARCH_INPUT_CLASSNAME, inputClassName)}
        value={query}
        onChange={(e) => updateQuery(e.target.value)}
        placeholder={inputPlaceholder ?? "Search"}
        onKeyDown={searchInputKeyDown}
      />
    </div>
  );
}
