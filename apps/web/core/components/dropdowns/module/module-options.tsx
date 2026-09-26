/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
// plane imports
import { useTranslation } from "@plane/i18n";
import { CheckIcon, SearchIcon, ModuleIcon } from "@plane/propel/icons";
import type { IModule } from "@plane/types";
import { cn, sortBySelectedFirst } from "@plane/utils";
// hooks

type DropdownOptions =
  | {
      value: string | null;
      query: string;
      content: React.ReactNode;
    }[]
  | undefined;

interface Props {
  getModuleById: (moduleId: string) => IModule | null;
  moduleIds?: string[];
  multiple: boolean;
  value?: string[] | string | null;
}

export const ModuleOptions = observer(function ModuleOptions(props: Props) {
  const { getModuleById, moduleIds, multiple, value } = props;
  // refs
  // states
  const [query, setQuery] = useState("");

  // plane hooks
  const { t } = useTranslation();
  // store hooks

  const options: DropdownOptions = moduleIds?.map((moduleId) => {
    const moduleDetails = getModuleById(moduleId);
    return {
      value: moduleId,
      query: `${moduleDetails?.name}`,
      content: (
        <div className="flex items-center gap-2">
          <ModuleIcon className="h-3 w-3 flex-shrink-0" />
          <span className="flex-grow truncate">{moduleDetails?.name}</span>
        </div>
      ),
    };
  });
  if (!multiple)
    options?.unshift({
      value: null,
      query: t("module.no_module"),
      content: (
        <div className="flex items-center gap-2">
          <ModuleIcon className="h-3 w-3 flex-shrink-0" />
          <span className="flex-grow truncate">{t("module.no_module")}</span>
        </div>
      ),
    });

  const filteredOptions = sortBySelectedFirst(
    query === "" ? options : options?.filter((o) => o.query.toLowerCase().includes(query.toLowerCase())),
    value
  );

  return (
    <div className="z-10">
      <div className="my-1 w-48 rounded-sm border-[0.5px] border-strong bg-surface-1 px-2 py-2.5 text-11 shadow-raised-200 focus:outline-none">
        <div className="flex items-center gap-1.5 rounded-sm border border-subtle bg-surface-2 px-2">
          <SearchIcon className="h-3.5 w-3.5 text-placeholder" strokeWidth={1.5} />
          <Combobox.Input
            className="w-full bg-transparent py-1 text-11 text-secondary placeholder:text-placeholder focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("common.search.label")}
          />
        </div>
        <Combobox.List className="mt-2 max-h-48 space-y-1 overflow-y-scroll">
          {filteredOptions ? (
            filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <Combobox.Item
                  key={option.value}
                  value={option.value}
                  className={({ highlighted: active, selected }) =>
                    cn(
                      "flex w-full cursor-pointer items-center justify-between gap-2 truncate rounded-sm px-1 py-1.5 select-none",
                      {
                        "bg-layer-transparent-hover": active,
                        "text-primary": selected,
                        "text-secondary": !selected,
                      }
                    )
                  }
                  render={(itemProps, { selected }) => (
                    <div {...itemProps}>
                      {
                        <>
                          <span className="flex-grow truncate">{option.content}</span>
                          {selected && <CheckIcon className="h-3.5 w-3.5 flex-shrink-0" />}
                        </>
                      }
                    </div>
                  )}
                ></Combobox.Item>
              ))
            ) : (
              <p className="px-1.5 py-1 text-placeholder italic">{t("common.search.no_matching_results")}</p>
            )
          ) : (
            <p className="px-1.5 py-1 text-placeholder italic">{t("common.loading")}</p>
          )}
        </Combobox.List>
      </div>
    </div>
  );
});
