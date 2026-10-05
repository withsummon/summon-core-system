import type { ComponentProps } from "react";
import { useMutation } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { defaultTaskPreferences } from "@summon/convex/task-schema";
import { Button } from "@plane/propel/button";
import { ViewDefinitionForm } from "./form";
import { ReferenceFilters } from "./filters";
type Detail = FunctionReturnType<typeof api.savedViews.workspace.get>;
function useWorkspaceFilterChoices(workspaceId: Id<"workspaces">) {
  const states = usePaginatedQuery(api.savedViews.workspaceChoices.states, { workspaceId }, { initialNumItems: 50 });
  const labels = usePaginatedQuery(api.savedViews.workspaceChoices.labels, { workspaceId }, { initialNumItems: 50 });
  const people = usePaginatedQuery(api.savedViews.workspaceChoices.people, { workspaceId }, { initialNumItems: 50 });
  const cycles = usePaginatedQuery(api.cycles.workspace.list, { workspaceId }, { initialNumItems: 50 });
  const modules = usePaginatedQuery(api.modules.workspace.list, { workspaceId }, { initialNumItems: 50 });
  return {
    choices: {
      users: people.results.map((person) => ({ id: person.id, label: person.name ?? "Unnamed member" })),
      states: states.results.map((state) => ({ id: state.id, label: `${state.project.identifier} · ${state.name}` })),
      labels: labels.results.map((label) => ({ id: label.id, label: `${label.project.identifier} · ${label.name}` })),
      cycles: cycles.results.map(({ cycle, project }) => ({
        id: cycle._id,
        label: `${project.identifier} · ${cycle.name}`,
      })),
      modules: modules.results.map(({ module, project }) => ({
        id: module._id,
        label: `${project.identifier} · ${module.name}`,
      })),
    },
    taxonomyControls: (
      <>
        {[states, labels, cycles, modules].some((rows) => rows.status === "LoadingFirstPage") && (
          <p role="status">Loading project choices…</p>
        )}
        <div className="flex flex-wrap gap-2">
          {states.status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => states.loadMore(50)}>
              Load more state choices
            </Button>
          )}
          {labels.status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => labels.loadMore(50)}>
              Load more label choices
            </Button>
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
        </div>
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
export function WorkspaceReferenceFilters({
  workspaceId,
  filters,
  selections,
  onChange,
}: {
  workspaceId: Id<"workspaces">;
  filters: FunctionArgs<typeof api.savedViews.workspace.create>["filters"];
  selections: ComponentProps<typeof ReferenceFilters>["selections"];
  onChange: (filters: FunctionArgs<typeof api.savedViews.workspace.create>["filters"]) => void;
}) {
  const choices = useWorkspaceFilterChoices(workspaceId);
  return <ReferenceFilters {...choices} filters={filters} selections={selections} onChange={onChange} />;
}
export function WorkspaceViewForm({
  workspaceId,
  initial,
  createSeed,
  onDone,
  onCancel,
  canEdit = true,
  onPendingChange,
}: {
  workspaceId: Id<"workspaces">;
  canEdit?: boolean;
  onPendingChange?: (pending: boolean) => void;
  initial: Detail | null;
  createSeed?: {
    input: Omit<FunctionArgs<typeof api.savedViews.workspace.create>, "workspaceId">;
    logo: Detail["logo"];
  };
  onDone: (id: Id<"savedViews">) => void;
  onCancel: () => void;
}) {
  const create = useMutation(api.savedViews.workspace.create),
    update = useMutation(api.savedViews.workspace.update);
  const choices = useWorkspaceFilterChoices(workspaceId);
  return (
    <ViewDefinitionForm
      {...choices}
      initial={initial}
      createSeed={createSeed}
      defaultDisplayFilters={{
        ...defaultTaskPreferences.displayFilters,
        layout: "spreadsheet",
        includeSubtasks: false,
        showEmptyGroups: false,
      }}
      canEdit={canEdit}
      onPendingChange={onPendingChange}
      onDone={onDone}
      onCancel={onCancel}
      scopeDescription="Saved for this workspace. Each person sees only tasks they can currently access."
      onSave={async (definition, snapshot) => {
        if (snapshot) {
          await update({ ...definition, viewId: snapshot.view._id, expectedUpdatedAt: snapshot.view.updatedAt });
          return snapshot.view._id;
        }
        return create({ ...definition, workspaceId });
      }}
    />
  );
}
