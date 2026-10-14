/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// components
// i18n
import { useTranslation } from "@plane/i18n";
// icon
import { CycleGroupIcon, CycleIcon } from "@plane/propel/icons";
import { filterOptionsByQuery, SearchableOptionsPanel } from "../searchable-options-panel";
import type { TSearchableOption } from "../searchable-options-panel";
import type { TCycleGroups } from "@plane/types";
// ui
// store hooks
import { useCycle } from "@/hooks/store/use-cycle";
// types

type DropdownOptions = TSearchableOption<string | null>[] | undefined;

type CycleOptionsProps = {
  projectId: string;
  canRemoveCycle: boolean;
  currentCycleId?: string;
};

export const CycleOptions = observer(function CycleOptions(props: CycleOptionsProps) {
  const { projectId, canRemoveCycle, currentCycleId } = props;
  // i18n
  const { t } = useTranslation();
  //state hooks
  const [query, setQuery] = useState("");

  // store hooks
  const { workspaceSlug } = useParams();
  const { getProjectCycleIds, fetchAllCycles, getCycleById } = useCycle();

  useEffect(() => {
    if (workspaceSlug && !getProjectCycleIds(projectId)) {
      void fetchAllCycles(workspaceSlug.toString(), projectId);
    }
  }, [workspaceSlug, projectId, getProjectCycleIds, fetchAllCycles]);

  const cycleIds = (getProjectCycleIds(projectId) ?? [])?.filter((cycleId) => {
    const cycleDetails = getCycleById(cycleId);
    if (currentCycleId && currentCycleId === cycleId) return false;
    return cycleDetails?.status ? cycleDetails.status.toLowerCase() !== "completed" : true;
  });

  const options: DropdownOptions = cycleIds?.map((cycleId) => {
    const cycleDetails = getCycleById(cycleId);
    const cycleStatus = cycleDetails?.status ? (cycleDetails.status.toLocaleLowerCase() as TCycleGroups) : "draft";

    return {
      value: cycleId,
      query: `${cycleDetails?.name}`,
      content: (
        <div className="flex items-center gap-2">
          <CycleGroupIcon cycleGroup={cycleStatus} className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="flex-grow truncate" title={cycleDetails?.name}>
            {cycleDetails?.name}
          </span>
        </div>
      ),
    };
  });

  if (canRemoveCycle) {
    options?.unshift({
      value: null,
      query: t("cycle.no_cycle"),
      content: (
        <div className="flex items-center gap-2">
          <CycleIcon className="h-3 w-3 flex-shrink-0" />
          <span className="flex-grow truncate">{t("cycle.no_cycle")}</span>
        </div>
      ),
    });
  }

  const filteredOptions = filterOptionsByQuery(options, query);

  return (
    <SearchableOptionsPanel
      query={query}
      onQueryChange={setQuery}
      options={filteredOptions}
      searchPlaceholder={t("common.search.label")}
      noResultsLabel={t("common.search.no_matches_found")}
    />
  );
});
