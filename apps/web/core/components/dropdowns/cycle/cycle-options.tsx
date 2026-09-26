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
    return cycleDetails?.status ? (cycleDetails?.status.toLowerCase() != "completed" ? true : false) : true;
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
          <span className="flex-grow truncate">{cycleDetails?.name}</span>
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
                    `flex w-full cursor-pointer items-center justify-between gap-2 truncate rounded-sm px-1 py-1.5 select-none ${
                      active ? "bg-layer-transparent-hover" : ""
                    } ${selected ? "text-primary" : "text-secondary"}`
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
              <p className="px-1.5 py-1 text-placeholder italic">{t("common.search.no_matches_found")}</p>
            )
          ) : (
            <p className="px-1.5 py-1 text-placeholder italic">{t("common.loading")}</p>
          )}
        </Combobox.List>
      </div>
    </div>
  );
});
