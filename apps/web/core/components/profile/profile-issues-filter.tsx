/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { profileTaskPreferencesSchema } from "@summon/convex/task-schema";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import {
  StatePropertyIcon,
  PriorityPropertyIcon,
  LabelPropertyIcon,
  StartDatePropertyIcon,
  DueDatePropertyIcon,
} from "@plane/propel/icons";
import { FilterInstance } from "@plane/shared-state";
import type { TFilterExpression } from "@plane/types";
import { COLLECTION_OPERATOR, EQUALITY_OPERATOR, EIssueLayoutTypes } from "@plane/types";
import {
  createFilterConfig,
  createOperatorConfigEntry,
  getMultiSelectConfig,
  getPriorityFilterConfig,
  getLabelFilterConfig,
  getStartDateFilterConfig,
  getTargetDateFilterConfig,
} from "@plane/utils";
import {
  FiltersDropdown,
  LayoutSelection,
  FilterDisplayProperties,
  FilterHeader,
  FilterOption,
} from "@/components/issues/issue-layouts/filters";
import { FiltersToggle } from "@/components/rich-filters/filters-toggle";
import { statusOptions } from "@/components/convex-core/tasks/options";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { useFiltersOperatorConfigs } from "@/hooks/rich-filters/use-filters-operator-configs";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";

type Preferences = FunctionReturnType<typeof api.tasks.profile.preferences>;
type FilterProperty = Extract<
  NonNullable<FunctionArgs<typeof api.tasks.profile.list>["filters"]>,
  { type: "condition" }
>["property"];

/** The repository filter builder produces an editable expression. Parse it at
 * the native preference writer before it becomes a generated RPC argument. */
export function useProfileTaskControls(workspaceId: Id<"workspaces">, workspaceSlug: string) {
  const preferences = useQuery(api.tasks.profile.preferences, { workspaceId });
  const mutate = useMutation(api.tasks.profile.savePreferences);
  const labels = usePaginatedQuery(api.savedViews.workspaceChoices.labels, { workspaceId }, { initialNumItems: 100 });
  const { status, loadMore } = labels;
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(100);
  }, [status, loadMore]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const filter = useMemo(
    () =>
      Object.assign(
        new FilterInstance<FilterProperty, TFilterExpression<FilterProperty> | null>({
          adapter: { toInternal: (expression) => expression, toExternal: (expression) => expression },
        }),
        { id: workspaceId }
      ),
    [workspaceId]
  );
  const save = useCallback(
    async (change: unknown) => {
      if (!preferences || pending) return;
      setPending(true);
      setError("");
      try {
        const parsed = profileTaskPreferencesSchema.partial().strict().parse(change);
        const result = await mutate({ workspaceId, expectedRevision: preferences.revision, ...parsed });
        if (parsed.filters !== undefined) filter.resetExpression(result.filters);
      } catch (failure) {
        setError(mutationMessage(failure));
      } finally {
        setPending(false);
      }
    },
    [preferences, pending, mutate, workspaceId, filter]
  );
  useReloadConfirmations(
    pending || (Boolean(error) && filter.hasChanges),
    "Profile filters have unsaved changes or are still saving.",
    undefined,
    pending
  );
  useEffect(() => {
    filter.onExpressionChange = (expression) => {
      if (filter.hasChanges) void save({ filters: expression });
    };
    filter.updateExpressionOptions({
      clearFilterOptions: { onFilterClear: () => {}, isDisabled: pending },
    });
    return () => {
      filter.onExpressionChange = undefined;
    };
  }, [filter, save, pending]);
  useEffect(() => {
    if (preferences && !pending && !filter.hasChanges) filter.resetExpression(preferences.filters);
  }, [preferences, filter, pending]);
  const operatorConfigs = useFiltersOperatorConfigs({ workspaceSlug });
  const { allowedOperators } = operatorConfigs;
  useEffect(() => {
    const params = { isEnabled: true, allowedOperators };
    filter.configManager.setAreConfigsReady(status === "Exhausted");
    filter.configManager.registerAll([
      createFilterConfig<FilterProperty>({
        id: "status",
        label: "State",
        icon: StatePropertyIcon,
        ...params,
        supportedOperatorConfigsMap: new Map([
          createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updated) =>
            getMultiSelectConfig(
              {
                items: statusOptions,
                getId: (item) => item.value,
                getLabel: (item) => item.label,
                getValue: (item) => item.value,
                getIconData: (item) => item.value,
              },
              { ...updated, singleValueOperator: EQUALITY_OPERATOR.EXACT }
            )
          ),
        ]),
      }),
      getPriorityFilterConfig<FilterProperty>("priority")({ ...params, filterIcon: PriorityPropertyIcon }),
      getLabelFilterConfig<FilterProperty>("labelId")({
        ...params,
        labels: labels.results,
        filterIcon: LabelPropertyIcon,
      }),
      getStartDateFilterConfig<FilterProperty>("startDate")({ ...params, filterIcon: StartDatePropertyIcon }),
      getTargetDateFilterConfig<FilterProperty>("targetDate")({ ...params, filterIcon: DueDatePropertyIcon }),
    ]);
  }, [filter, allowedOperators, labels.results, status]);
  return {
    preferences,
    filter,
    pending,
    error,
    save,
    labels,
    reset() {
      if (preferences) filter.resetExpression(preferences.filters);
      setError("");
    },
  };
}

const groupOptions = {
  status: { value: "status", label: "State" },
  priority: { value: "priority", label: "Priority" },
  projectId: { value: "projectId", label: "Project" },
  labelId: { value: "labelId", label: "Labels" },
} as const satisfies { [Key in NonNullable<Preferences["displayFilters"]["groupBy"]>]: { value: Key; label: string } };
const orderOptions = {
  sortOrder: { value: "sortOrder", label: "Manual" },
  createdAt: { value: "createdAt", label: "Date created" },
  updatedAt: { value: "updatedAt", label: "Date updated" },
  startDate: { value: "startDate", label: "Start date" },
  priority: { value: "priority", label: "Priority" },
} as const satisfies { [Key in Preferences["displayFilters"]["order"]]: { value: Key; label: string } };
const extraOptions = {
  showEmptyGroups: "Show empty groups",
  includeSubtasks: "Show sub-work items",
} satisfies Record<Exclude<keyof Preferences["displayFilters"], "layout" | "groupBy" | "order">, string>;

export const ProfileIssuesFilter = observer(function ProfileIssuesFilter({
  controls,
}: {
  controls: ReturnType<typeof useProfileTaskControls>;
}) {
  const { t } = useTranslation();
  const { preferences, filter, pending, save } = controls;
  const [groupExpanded, setGroupExpanded] = useState(true);
  const [orderExpanded, setOrderExpanded] = useState(true);
  const [optionsExpanded, setOptionsExpanded] = useState(true);
  if (!preferences) return null;
  const { displayFilters, displayProperties } = preferences;
  const changeDisplay = (change: Partial<Preferences["displayFilters"]>) =>
    void save({ displayFilters: { ...displayFilters, ...change } });
  return (
    <div className="relative flex items-center justify-end gap-2">
      <LayoutSelection
        layouts={[EIssueLayoutTypes.LIST, EIssueLayoutTypes.KANBAN]}
        selectedLayout={displayFilters.layout}
        disabled={pending}
        onChange={(layout) => void save({ displayFilters: { ...displayFilters, layout } })}
      />
      <FiltersToggle filter={filter} disabled={pending || !filter.configManager.areConfigsReady} />
      <FiltersDropdown title={t("common.display")} placement="bottom-end" disabled={pending}>
        <fieldset
          disabled={pending}
          aria-busy={pending}
          className="vertical-scrollbar scrollbar-sm h-full divide-y divide-subtle-1 overflow-y-auto px-2.5"
        >
          <legend className="sr-only">Work item display</legend>
          <div className="py-2">
            <FilterDisplayProperties
              displayProperties={displayProperties}
              displayPropertiesToRender={profileTaskPreferencesSchema.shape.displayProperties.keyof().options}
              handleUpdate={(change) => void save({ displayProperties: { ...displayProperties, ...change } })}
            />
          </div>
          <div className="py-2">
            <FilterHeader
              title={t("common.group_by")}
              isPreviewEnabled={groupExpanded}
              handleIsPreviewEnabled={() => setGroupExpanded((value) => !value)}
            />
            {groupExpanded && (
              <div className="mt-1">
                {Object.values(groupOptions).map((option) => (
                  <FilterOption
                    key={option.value}
                    title={option.label}
                    multiple={false}
                    isChecked={displayFilters.groupBy === option.value}
                    onClick={() => changeDisplay({ groupBy: option.value })}
                  />
                ))}
                {displayFilters.layout === "list" && (
                  <FilterOption
                    title="None"
                    multiple={false}
                    isChecked={displayFilters.groupBy === null}
                    onClick={() => changeDisplay({ groupBy: null })}
                  />
                )}
              </div>
            )}
          </div>
          <div className="py-2">
            <FilterHeader
              title={t("common.order_by.label")}
              isPreviewEnabled={orderExpanded}
              handleIsPreviewEnabled={() => setOrderExpanded((value) => !value)}
            />
            {orderExpanded && (
              <div className="mt-1">
                {Object.values(orderOptions).map((option) => (
                  <FilterOption
                    key={option.value}
                    title={option.label}
                    multiple={false}
                    isChecked={displayFilters.order === option.value}
                    onClick={() => changeDisplay({ order: option.value })}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="py-2">
            <FilterHeader
              title={t("common.options")}
              isPreviewEnabled={optionsExpanded}
              handleIsPreviewEnabled={() => setOptionsExpanded((value) => !value)}
            />
            {optionsExpanded && (
              <div className="mt-1">
                <FilterOption
                  title={extraOptions.showEmptyGroups}
                  isChecked={displayFilters.showEmptyGroups}
                  onClick={() => changeDisplay({ showEmptyGroups: !displayFilters.showEmptyGroups })}
                />
                {displayFilters.layout === "list" && (
                  <FilterOption
                    title={extraOptions.includeSubtasks}
                    isChecked={displayFilters.includeSubtasks}
                    onClick={() => changeDisplay({ includeSubtasks: !displayFilters.includeSubtasks })}
                  />
                )}
              </div>
            )}
          </div>
        </fieldset>
      </FiltersDropdown>
    </div>
  );
});

export const ProfileFiltersFailure = observer(function ProfileFiltersFailure({
  controls,
}: {
  controls: ReturnType<typeof useProfileTaskControls>;
}) {
  const { error, pending, filter, save } = controls;
  if (!error) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2">
      <p role="alert" className="text-13 text-danger-primary">
        {error}
      </p>
      {filter.hasChanges && (
        <Button variant="secondary" disabled={pending} onClick={() => void save({ filters: filter.expression })}>
          Retry filters
        </Button>
      )}
      <Button variant="secondary" disabled={pending} onClick={controls.reset}>
        Use saved filters
      </Button>
    </div>
  );
});
