import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import type { Id } from "@summon/convex/data-model";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { taskCondition } from "@summon/convex/task-schema";
import { FilterInstance } from "@plane/shared-state";
import type { TFilterExpression, TLogicalOperator } from "@plane/types";
import {
  COLLECTION_OPERATOR,
  COMPARISON_OPERATOR,
  EQUALITY_OPERATOR,
  EXTENDED_COMPARISON_OPERATOR,
} from "@plane/types";
import {
  createFilterConfig,
  createOperatorConfigEntry,
  getMultiSelectConfig,
  getPriorityFilterConfig,
  getStartDateFilterConfig,
  getTargetDateFilterConfig,
  traverseExpressionTree,
} from "@plane/utils";
import {
  PriorityPropertyIcon,
  StatePropertyIcon,
  StartDatePropertyIcon,
  DueDatePropertyIcon,
} from "@plane/propel/icons";
import { FiltersRow } from "@/components/rich-filters/filters-row";
import { statusOptions } from "../tasks/options";
import { retainedChoices } from "./choices";
type Filters = FunctionArgs<typeof api.savedViews.index.create>["filters"];
type FilterProperty = Extract<NonNullable<Filters>, { type: "condition" }>["property"];
export function FilterChoices<T extends string>({
  label,
  options,
  selections = [],
  unavailableLabel = "Unavailable selection",
  selected,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  selections?: Parameters<typeof retainedChoices<T>>[1];
  unavailableLabel?: string;
  selected: T[];
  onChange: (values: T[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-14 font-medium">{label}</legend>
      <div className="flex max-h-48 flex-wrap gap-x-4 gap-y-2 overflow-y-auto">
        {retainedChoices(options, selections, selected, unavailableLabel).map((option) => (
          <label key={option.id} className="flex min-w-0 items-center gap-2 text-14">
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={(event) =>
                onChange(event.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id))
              }
            />
            <span className="break-words">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function useTaskFilterDraft(initialFilters: Filters, ownerId: string) {
  const filter = useMemo(
    () =>
      Object.assign(
        new FilterInstance<FilterProperty, TFilterExpression<FilterProperty> | null>({
          initialExpression: initialFilters,
          adapter: { toInternal: (expression) => expression, toExternal: (expression) => expression },
        }),
        { id: ownerId }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Seed once per owner; the clean adoption effect handles later snapshots without discarding dirty edits.
    [ownerId]
  );
  useEffect(() => {
    if (!filter.hasChanges) filter.resetExpression(initialFilters);
  }, [filter, initialFilters, filter.hasChanges]);
  return filter;
}
export const ReferenceFilters = observer(function ReferenceFilters({
  choices,
  selections,
  filter,
  taxonomyControls,
  peopleControls,
  disabled = false,
}: {
  choices: {
    users: { id: Id<"users">; label: string }[];
    states: { id: Id<"taskStates">; label: string }[];
    labels: { id: Id<"taskLabels">; label: string }[];
    cycles: { id: Id<"cycles">; label: string }[];
    modules: { id: Id<"modules">; label: string }[];
    projects: { id: Id<"projects">; label: string }[];
  };
  selections?: FunctionReturnType<typeof api.savedViews.index.get>["selections"];
  filter: ReturnType<typeof useTaskFilterDraft>;
  taxonomyControls: ReactNode;
  peopleControls: ReactNode;
  disabled?: boolean;
}) {
  const [logicalOperator, setLogicalOperator] = useState<TLogicalOperator>(
    filter.expression?.type === "group" ? filter.expression.logicalOperator : "and"
  );
  useEffect(() => {
    filter.updateExpressionOptions({ clearFilterOptions: { onFilterClear: () => {}, isDisabled: disabled } });
  }, [filter, disabled]);
  useEffect(() => {
    if (filter.expression?.type === "group") setLogicalOperator(filter.expression.logicalOperator);
  }, [filter.expression]);
  const conditions = traverseExpressionTree(filter.expression, (node) => {
    const parsed = taskCondition.safeParse(node);
    return parsed.success ? parsed.data : null;
  });
  useEffect(() => {
    const allowedOperators = new Set([
      EQUALITY_OPERATOR.EXACT,
      COLLECTION_OPERATOR.IN,
      COMPARISON_OPERATOR.RANGE,
      EXTENDED_COMPARISON_OPERATOR.GTE,
      EXTENDED_COMPARISON_OPERATOR.LTE,
    ]);
    const params = { isEnabled: true, allowedOperators };
    const references = conditions.filter(
      (condition) =>
        condition.property !== "priority" &&
        condition.property !== "status" &&
        condition.property !== "startDate" &&
        condition.property !== "targetDate"
    );
    const referenceChoices = [
      { id: "stateId", label: "Workflow state", available: choices.states, saved: selections?.states ?? [] },
      { id: "labelId", label: "Labels", available: choices.labels, saved: selections?.labels ?? [] },
      { id: "assigneeId", label: "Assignees", available: choices.users, saved: selections?.users ?? [] },
      { id: "createdBy", label: "Created by", available: choices.users, saved: selections?.users ?? [] },
      { id: "subscriberId", label: "Subscribers", available: choices.users, saved: selections?.users ?? [] },
      { id: "cycleId", label: "Cycles", available: choices.cycles, saved: selections?.cycles ?? [] },
      { id: "moduleId", label: "Modules", available: choices.modules, saved: selections?.modules ?? [] },
      { id: "projectId", label: "Projects", available: choices.projects, saved: selections?.projects ?? [] },
    ] as const;
    filter.configManager.registerAll([
      createFilterConfig<FilterProperty>({
        id: "status",
        label: "State group",
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
      ...referenceChoices.map((reference) => {
        const selected = references
          .filter((condition) => condition.property === reference.id)
          .flatMap(({ value }) => (Array.isArray(value) ? value : [value]));
        const items = retainedChoices<string>(reference.available, reference.saved, selected, "Saved selection");
        return createFilterConfig<FilterProperty>({
          id: reference.id,
          label: reference.label,
          ...params,
          supportedOperatorConfigsMap: new Map([
            createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updated) =>
              getMultiSelectConfig(
                {
                  items,
                  getId: (item) => item.id,
                  getLabel: (item) => item.label,
                  getValue: (item) => item.id,
                  getIconData: (item) => item.id,
                },
                { ...updated, singleValueOperator: EQUALITY_OPERATOR.EXACT }
              )
            ),
          ]),
        });
      }),
      getStartDateFilterConfig<FilterProperty>("startDate")({ ...params, filterIcon: StartDatePropertyIcon }),
      getTargetDateFilterConfig<FilterProperty>("targetDate")({ ...params, filterIcon: DueDatePropertyIcon }),
    ]);
    filter.configManager.setAreConfigsReady(true);
  }, [filter, conditions, choices, selections]);
  const operator = filter.expression?.type === "group" ? filter.expression.logicalOperator : logicalOperator;
  return (
    <div className="space-y-3">
      <fieldset disabled={disabled} className="flex flex-wrap gap-4">
        <legend className="mb-2 text-14 font-medium">Combine top-level filters</legend>
        {(["and", "or"] as const).map((value) => (
          <label key={value} className="flex items-center gap-2 text-14">
            <input
              type="radio"
              name={`filter-match-${filter.id}`}
              checked={operator === value}
              onChange={() => {
                setLogicalOperator(value);
                if (filter.expression?.type === "group")
                  filter.resetExpression({ ...filter.expression, logicalOperator: value }, false);
              }}
            />
            Match {value === "and" ? "all" : "any"}
          </label>
        ))}
      </fieldset>
      <FiltersRow filter={filter} variant="modal" disabledAllOperations={disabled} logicalOperator={operator} />
      {taxonomyControls}
      {peopleControls}
    </div>
  );
});
