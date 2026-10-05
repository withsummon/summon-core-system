import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import {
  defaultTaskPreferences,
  taskDisplayFiltersSchema,
  taskDisplayPropertiesSchema,
} from "@summon/convex/task-schema";
import { EIssueLayoutTypes } from "@plane/types";
import { Select } from "@plane/propel/select";
import { LayoutSelection, FilterDisplayProperties } from "@/components/issues/issue-layouts/filters";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { ProjectLogoPicker } from "@/components/project/create/header";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { mutationMessage } from "../commercial/forms";
import { BasicFilters, ReferenceFilters } from "./filters";
type Detail =
  | FunctionReturnType<typeof api.savedViews.index.get>
  | FunctionReturnType<typeof api.savedViews.workspace.get>;
type DisplayFilters = NonNullable<FunctionArgs<typeof api.savedViews.index.create>["displayFilters"]>;
const groupLabels = {
  stateId: "State",
  priority: "Priority",
  cycleId: "Cycle",
  moduleId: "Module",
  labelId: "Labels",
  assigneeId: "Assignees",
  createdBy: "Created by",
} satisfies Record<Exclude<DisplayFilters["groupBy"], null>, string>;
const orderLabels = {
  sortOrder: "Manual",
  createdAt: "Newest created",
  updatedAt: "Newest updated",
  startDate: "Start date",
  priority: "Priority",
  targetDate: "Due date",
} satisfies Record<DisplayFilters["order"], string>;
type Filters = FunctionArgs<typeof api.savedViews.index.create>["filters"];
const emptyFilters: Filters = {
  match: "all",
  statuses: [],
  stateIds: [],
  priorities: [],
  assigneeIds: [],
  labelIds: [],
  creatorIds: [],
  startDate: null,
  targetDate: null,
};
function useProjectFilterChoices(projectId: Id<"projects">) {
  const states = useQuery(api.tasks.states.list, { projectId }),
    labels = useQuery(api.tasks.labels.list, { projectId });
  const people = usePaginatedQuery(api.modules.members.choices, { projectId }, { initialNumItems: 50 });
  const cycles = usePaginatedQuery(api.cycles.index.list, { projectId, deleted: false }, { initialNumItems: 50 });
  const modules = usePaginatedQuery(api.modules.index.list, { projectId, deleted: false }, { initialNumItems: 50 });
  return {
    choices: {
      users: people.results.map((person) => ({
        id: person.userId,
        label: person.name,
      })),
      states: (states ?? []).map((state) => ({ id: state._id, label: state.name })),
      labels: (labels ?? []).map((label) => ({ id: label._id, label: label.name })),
      cycles: cycles.results.map((cycle) => ({ id: cycle._id, label: cycle.name })),
      modules: modules.results.map((module) => ({ id: module._id, label: module.name })),
    },
    taxonomyControls: (
      <>
        {(!states || !labels || cycles.status === "LoadingFirstPage" || modules.status === "LoadingFirstPage") && (
          <p role="status">Loading project choices…</p>
        )}
        {cycles.status === "CanLoadMore" && (
          <Button variant="secondary" onClick={() => cycles.loadMore(50)}>
            Load more cycle choices
          </Button>
        )}
        {modules.status === "CanLoadMore" && (
          <Button variant="secondary" onClick={() => modules.loadMore(50)}>
            Load more module choices
          </Button>
        )}
      </>
    ),
    peopleControls: (
      <>
        {people.status === "LoadingFirstPage" && <p role="status">Loading member choices…</p>}
        {people.status === "CanLoadMore" && (
          <Button variant="secondary" onClick={() => people.loadMore(50)}>
            Load more member choices
          </Button>
        )}
      </>
    ),
  };
}
export function ProjectReferenceFilters({
  projectId,
  filters,
  selections,
  onChange,
}: {
  projectId: Id<"projects">;
  filters: Filters;
  selections: ComponentProps<typeof ReferenceFilters>["selections"];
  onChange: (filters: Filters) => void;
}) {
  const choices = useProjectFilterChoices(projectId);
  return <ReferenceFilters {...choices} filters={filters} selections={selections} onChange={onChange} />;
}
export function SavedViewForm({
  projectId,
  initial,
  createSeed,
  onDone,
  onCancel,
  canEdit = true,
  onPendingChange,
}: {
  projectId: Id<"projects">;
  canEdit?: boolean;
  onPendingChange?: (pending: boolean) => void;
  initial: Detail | null;
  createSeed?: { input: Omit<FunctionArgs<typeof api.savedViews.index.create>, "projectId">; logo: Detail["logo"] };
  onDone: (id: Id<"savedViews">) => void;
  onCancel: () => void;
}) {
  const create = useMutation(api.savedViews.index.create),
    update = useMutation(api.savedViews.index.update);
  const { choices, taxonomyControls, peopleControls } = useProjectFilterChoices(projectId);
  return (
    <ViewDefinitionForm
      initial={initial}
      createSeed={createSeed}
      defaultDisplayFilters={{
        ...defaultTaskPreferences.displayFilters,
        groupBy: "stateId",
        order: "sortOrder",
        includeSubtasks: false,
        showEmptyGroups: false,
      }}
      canEdit={canEdit}
      onPendingChange={onPendingChange}
      onDone={onDone}
      onCancel={onCancel}
      scopeDescription="Saved for this project. Guest visibility follows the project’s feature settings."
      choices={choices}
      taxonomyControls={taxonomyControls}
      peopleControls={peopleControls}
      onSave={async (data, snapshot) => {
        if (snapshot) {
          await update({ ...data, viewId: snapshot.view._id, expectedUpdatedAt: snapshot.view.updatedAt });
          return snapshot.view._id;
        }
        return create({ ...data, projectId });
      }}
    />
  );
}
export function ViewDefinitionForm({
  initial,
  createSeed,
  onSave,
  onDone,
  onCancel,
  choices,
  taxonomyControls,
  peopleControls,
  scopeDescription,
  canEdit,
  onPendingChange,
  defaultDisplayFilters,
}: {
  defaultDisplayFilters: DisplayFilters;
  initial: Detail | null;
  createSeed?: { input: Omit<FunctionArgs<typeof api.savedViews.index.create>, "projectId">; logo: Detail["logo"] };
  onSave: (
    definition: Pick<
      FunctionArgs<typeof api.savedViews.index.create>,
      "name" | "description" | "filters" | "access" | "logoProps" | "displayFilters" | "displayProperties"
    >,
    snapshot: Detail | null
  ) => Promise<Id<"savedViews">>;
  onDone: (id: Id<"savedViews">) => void;
  onCancel: () => void;
  choices: ComponentProps<typeof ReferenceFilters>["choices"];
  taxonomyControls: ReactNode;
  peopleControls: ReactNode;
  scopeDescription: string;
  canEdit: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [snapshot] = useState(initial);
  const [original] = useState<
    Pick<FunctionArgs<typeof api.savedViews.index.create>, "name" | "description" | "filters"> & {
      access: NonNullable<FunctionArgs<typeof api.savedViews.index.create>["access"]>;
      logo: ComponentProps<typeof ProjectLogoPicker>["value"];
      displayFilters: DisplayFilters;
      displayProperties: NonNullable<FunctionArgs<typeof api.savedViews.index.create>["displayProperties"]>;
    }
  >(() =>
    initial
      ? {
          name: initial.view.name,
          description: initial.view.description,
          filters: initial.view.filters,
          displayFilters: initial.view.displayFilters,
          displayProperties: initial.view.displayProperties,
          access: initial.view.access,
          logo: initial.logo ?? undefined,
        }
      : {
          name: createSeed?.input.name ?? "",
          description: createSeed?.input.description ?? "",
          filters: createSeed?.input.filters ?? emptyFilters,
          displayFilters: createSeed?.input.displayFilters ?? defaultDisplayFilters,
          displayProperties: createSeed?.input.displayProperties ?? defaultTaskPreferences.displayProperties,
          access: createSeed?.input.access ?? "public",
          logo: createSeed?.logo ?? undefined,
        }
  );
  const [draft, setDraft] = useState(original);
  const { name, description, filters, access, logo, displayFilters, displayProperties } = draft;
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const release = useReloadConfirmations(dirty, "This view has unsaved changes.", onCancel, pending);
  return (
    <form
      className="max-w-4xl space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending || !canEdit) return;
        setPending(true);
        onPendingChange?.(true);
        setError("");
        try {
          const data = {
            name,
            description,
            filters,
            access,
            displayFilters,
            displayProperties,
            logoProps: { ...(snapshot?.view.logoProps ?? createSeed?.input.logoProps), ...logo },
          };
          const id = await onSave(data, snapshot);
          release((allowNavigation) => {
            onCancel();
            if (allowNavigation) onDone(id);
          });
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
          onPendingChange?.(false);
        }
      }}
    >
      <h2 className="text-24 font-semibold">{snapshot ? "Edit saved view" : "Create saved view"}</h2>
      <fieldset disabled={pending || !canEdit} className="space-y-4">
        <SummonField label="View icon">
          <ProjectLogoPicker
            value={logo}
            onChange={(value) => setDraft({ ...draft, logo: value })}
            disabled={pending || !canEdit}
            iconType="lucide"
          />
        </SummonField>
        <SummonField label="View name">
          <Input
            required
            maxLength={255}
            value={name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </SummonField>
        <SummonField label="View description" htmlFor="saved-view-description">
          <textarea
            id="saved-view-description"
            className="w-full rounded-md border border-subtle-1 bg-layer-2 p-2 text-14"
            rows={2}
            maxLength={10000}
            value={description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </SummonField>
        <p className="text-14 text-secondary">{scopeDescription}</p>
        <div role="group" aria-label="View visibility" className="space-y-2">
          <span className="block text-14 font-medium">Visibility</span>
          <div className="flex gap-2">
            <Button
              variant={access === "private" ? "primary" : "secondary"}
              aria-pressed={access === "private"}
              onClick={() => setDraft({ ...draft, access: "private" })}
            >
              Private
            </Button>
            <Button
              variant={access === "public" ? "primary" : "secondary"}
              aria-pressed={access === "public"}
              onClick={() => setDraft({ ...draft, access: "public" })}
            >
              Public
            </Button>
          </div>
          <p className="text-12 text-secondary">
            Private views are visible only to you. Public views are shared with current members in this scope.
          </p>
        </div>
        <ViewDisplayFields
          displayFilters={displayFilters}
          displayProperties={displayProperties}
          disabled={pending || !canEdit}
          onChange={(display) => setDraft({ ...draft, ...display })}
        />
        <BasicFilters filters={filters} onChange={(value) => setDraft({ ...draft, filters: value })} />
        <ReferenceFilters
          choices={choices}
          selections={initial?.selections}
          filters={filters}
          onChange={(value) => setDraft({ ...draft, filters: value })}
          taxonomyControls={taxonomyControls}
          peopleControls={peopleControls}
        />
      </fieldset>
      {!canEdit && <p className="text-14 text-secondary">This view is read-only. Your draft is retained.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending} disabled={!canEdit}>
          Save view
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}

export function ViewDisplayFields({
  layouts = [
    EIssueLayoutTypes.LIST,
    EIssueLayoutTypes.KANBAN,
    EIssueLayoutTypes.CALENDAR,
    EIssueLayoutTypes.SPREADSHEET,
    EIssueLayoutTypes.GANTT,
  ],
  displayFilters,
  displayProperties,
  disabled,
  onChange,
}: {
  layouts?: ComponentProps<typeof LayoutSelection>["layouts"];
  displayFilters: DisplayFilters;
  displayProperties: NonNullable<FunctionArgs<typeof api.savedViews.index.create>["displayProperties"]>;
  disabled: boolean;
  onChange: (display: {
    displayFilters: DisplayFilters;
    displayProperties: NonNullable<FunctionArgs<typeof api.savedViews.index.create>["displayProperties"]>;
  }) => void;
}) {
  const changeFilters = (change: Partial<DisplayFilters>) =>
    onChange({
      displayFilters: { ...displayFilters, ...change },
      displayProperties,
    });
  return (
    <>
      <LayoutSelection
        layouts={layouts}
        selectedLayout={displayFilters.layout}
        disabled={disabled}
        onChange={(layout) =>
          changeFilters({
            layout,
            groupBy: layout === "kanban" && displayFilters.groupBy === null ? "stateId" : displayFilters.groupBy,
          })
        }
      />
      <details className="space-y-3 rounded-md border border-subtle-1 p-3">
        <summary className="cursor-pointer text-14 font-medium">Display</summary>
        <div className="grid gap-3 sm:grid-cols-2">
          {(displayFilters.layout === "list" || displayFilters.layout === "kanban") && (
            <SummonField label="Group by" htmlFor="saved-view-group">
              <Select
                id="saved-view-group"
                value={displayFilters.groupBy ?? ""}
                disabled={disabled}
                options={[
                  { value: "", label: "None", disabled: displayFilters.layout === "kanban" },
                  ...Object.entries(groupLabels).map(([value, label]) => ({ value, label })),
                ]}
                onValueChange={(value) => {
                  const groupBy = taskDisplayFiltersSchema.shape.groupBy.parse(value === "" ? null : value);
                  changeFilters({
                    groupBy,
                    subGroupBy:
                      groupBy === null || groupBy === displayFilters.subGroupBy ? null : displayFilters.subGroupBy,
                  });
                }}
              />
            </SummonField>
          )}
          {displayFilters.layout === "kanban" && (
            <SummonField label="Subgroup by" htmlFor="saved-view-subgroup">
              <Select
                id="saved-view-subgroup"
                value={displayFilters.subGroupBy ?? ""}
                disabled={disabled}
                options={[
                  { value: "", label: "None" },
                  ...Object.entries(groupLabels).map(([value, label]) => ({
                    value,
                    label,
                    disabled: value === displayFilters.groupBy,
                  })),
                ]}
                onValueChange={(value) =>
                  changeFilters({
                    subGroupBy: taskDisplayFiltersSchema.shape.subGroupBy.parse(value === "" ? null : value),
                  })
                }
              />
            </SummonField>
          )}
          {displayFilters.layout !== "calendar" && (
            <SummonField label="Order by" htmlFor="saved-view-order">
              <Select
                id="saved-view-order"
                value={displayFilters.order}
                disabled={disabled}
                options={Object.entries(orderLabels).map(([value, label]) => ({
                  value,
                  label,
                  disabled:
                    value === "targetDate" && displayFilters.layout !== "list" && displayFilters.layout !== "kanban",
                }))}
                onValueChange={(value) => changeFilters({ order: taskDisplayFiltersSchema.shape.order.parse(value) })}
              />
            </SummonField>
          )}
          {displayFilters.layout === "calendar" && (
            <SummonField label="Calendar layout" htmlFor="saved-view-calendar">
              <Select
                id="saved-view-calendar"
                value={displayFilters.calendar.layout}
                disabled={disabled}
                options={[
                  { value: "month", label: "Month" },
                  { value: "week", label: "Week" },
                ]}
                onValueChange={(value) =>
                  changeFilters({
                    calendar: {
                      ...displayFilters.calendar,
                      layout: taskDisplayFiltersSchema.shape.calendar.shape.layout.parse(value),
                    },
                  })
                }
              />
            </SummonField>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            aria-pressed={displayFilters.includeSubtasks}
            onClick={() => changeFilters({ includeSubtasks: !displayFilters.includeSubtasks })}
          >
            Show sub-work items
          </Button>
          {(displayFilters.layout === "list" || displayFilters.layout === "kanban") && (
            <Button
              variant="secondary"
              aria-pressed={displayFilters.showEmptyGroups}
              onClick={() => changeFilters({ showEmptyGroups: !displayFilters.showEmptyGroups })}
            >
              Show empty groups
            </Button>
          )}
          {displayFilters.layout === "calendar" && (
            <Button
              variant="secondary"
              aria-pressed={displayFilters.calendar.showWeekends}
              onClick={() =>
                changeFilters({
                  calendar: { ...displayFilters.calendar, showWeekends: !displayFilters.calendar.showWeekends },
                })
              }
            >
              Show weekends
            </Button>
          )}
        </div>
        <FilterDisplayProperties
          displayProperties={displayProperties}
          displayPropertiesToRender={
            displayFilters.layout === "calendar" || displayFilters.layout === "gantt_chart"
              ? ["key", "issue_type"]
              : taskDisplayPropertiesSchema.keyof().options
          }
          handleUpdate={(change) =>
            onChange({ displayFilters, displayProperties: { ...displayProperties, ...change } })
          }
        />
      </details>
    </>
  );
}
