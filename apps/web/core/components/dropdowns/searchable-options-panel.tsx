/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
import { useTranslation } from "@plane/i18n";
import { CheckIcon, SearchIcon } from "@plane/propel/icons";
import { POPUP_OPTION_CLASSNAME, POPUP_SEARCH_CLASSNAME, POPUP_SEARCH_INPUT_CLASSNAME } from "@plane/propel/popover";

export type TSearchableOption<V> = {
  value: V;
  query: string;
  content: ReactNode;
};

type Props<V> = {
  query: string;
  onQueryChange: (query: string) => void;
  /** Already filtered by `query`; `undefined` while the options are loading. */
  options: TSearchableOption<V>[] | undefined;
  searchPlaceholder: string;
  noResultsLabel: string;
};

/** Search field plus a checkable option list, shared by the combobox dropdowns. */
export function SearchableOptionsPanel<V extends string | null>(props: Props<V>) {
  const { query, onQueryChange, options, searchPlaceholder, noResultsLabel } = props;
  const { t } = useTranslation();

  return (
    <div className="z-10">
      <div className="w-56 max-w-[calc(100vw-2rem)]">
        <div className={POPUP_SEARCH_CLASSNAME}>
          <SearchIcon className="size-3.5 flex-none" />
          <Combobox.Input
            className={POPUP_SEARCH_INPUT_CLASSNAME}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
        <Combobox.List className="max-h-60 overflow-y-auto">
          {options ? (
            options.length > 0 ? (
              options.map((option) => (
                <Combobox.Item
                  key={option.value}
                  value={option.value}
                  className={POPUP_OPTION_CLASSNAME}
                  render={(itemProps, { selected }) => (
                    <div {...itemProps}>
                      <span className="flex-grow truncate">{option.content}</span>
                      {selected && <CheckIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                    </div>
                  )}
                ></Combobox.Item>
              ))
            ) : (
              <p className="px-2 py-1.5 text-placeholder">{noResultsLabel}</p>
            )
          ) : (
            <p className="px-2 py-1.5 text-placeholder">{t("common.loading")}</p>
          )}
        </Combobox.List>
      </div>
    </div>
  );
}

export function filterOptionsByQuery<T extends { query: string }>(options: T[], query: string): T[];
export function filterOptionsByQuery<T extends { query: string }>(
  options: T[] | undefined,
  query: string
): T[] | undefined;
export function filterOptionsByQuery<T extends { query: string }>(options: T[] | undefined, query: string) {
  return query === "" ? options : options?.filter((o) => o.query.toLowerCase().includes(query.toLowerCase()));
}
