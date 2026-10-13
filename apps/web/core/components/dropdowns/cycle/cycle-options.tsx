/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// components
import { ComboboxPrimitive as Combobox } from "@plane/propel/combobox";
// i18n
import { useTranslation } from "@plane/i18n";
// icon
import { CheckIcon, CycleGroupIcon, CycleIcon, SearchIcon } from "@plane/propel/icons";
import { POPUP_OPTION_CLASSNAME, POPUP_SEARCH_CLASSNAME, POPUP_SEARCH_INPUT_CLASSNAME } from "@plane/propel/popover";
import type { TCycleGroups } from "@plane/types";
// ui
// store hooks
import { useCycle } from "@/hooks/store/use-cycle";
// types

type DropdownOptions =
  | {
      value: string | null;
      query: string;
      content: React.ReactNode;
    }[]
  | undefined;

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

  const filteredOptions =
    query === "" ? options : options?.filter((o) => o.query.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="z-10">
      <div className="w-56 max-w-[calc(100vw-2rem)]">
        <div className={POPUP_SEARCH_CLASSNAME}>
          <SearchIcon className="size-3.5 flex-none" />
          <Combobox.Input
            className={POPUP_SEARCH_INPUT_CLASSNAME}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("common.search.label")}
          />
        </div>
        <Combobox.List className="max-h-60 overflow-y-auto">
          {filteredOptions ? (
            filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <Combobox.Item
                  key={option.value}
                  value={option.value}
                  className={POPUP_OPTION_CLASSNAME}
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
              <p className="px-2 py-1.5 text-placeholder">{t("common.search.no_matches_found")}</p>
            )
          ) : (
            <p className="px-2 py-1.5 text-placeholder">{t("common.loading")}</p>
          )}
        </Combobox.List>
      </div>
    </div>
  );
});
