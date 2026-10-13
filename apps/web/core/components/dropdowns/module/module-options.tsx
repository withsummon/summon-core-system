/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { ModuleIcon } from "@plane/propel/icons";
import { filterOptionsByQuery, SearchableOptionsPanel } from "../searchable-options-panel";
import type { TSearchableOption } from "../searchable-options-panel";
import type { IModule } from "@plane/types";
import { sortBySelectedFirst } from "@plane/utils";
// hooks

type DropdownOptions = TSearchableOption<string | null>[] | undefined;

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
          <span className="flex-grow truncate" title={moduleDetails?.name}>
            {moduleDetails?.name}
          </span>
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

  const filteredOptions = sortBySelectedFirst(filterOptionsByQuery(options, query), value);

  return (
    <SearchableOptionsPanel
      query={query}
      onQueryChange={setQuery}
      options={filteredOptions}
      searchPlaceholder={t("common.search.label")}
      noResultsLabel={t("common.search.no_matching_results")}
    />
  );
});
