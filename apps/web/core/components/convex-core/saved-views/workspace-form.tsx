import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { ViewDefinitionForm } from "./form";
type Detail = FunctionReturnType<typeof api.savedViews.workspace.get>;
export function WorkspaceViewForm({
  workspaceId,
  initial,
  onDone,
  onCancel,
}: {
  workspaceId: Id<"workspaces">;
  initial: Detail | null;
  onDone: (id: Id<"savedViews">) => void;
  onCancel: () => void;
}) {
  const create = useMutation(api.savedViews.workspace.create),
    update = useMutation(api.savedViews.workspace.update);
  const states = usePaginatedQuery(api.savedViews.workspaceChoices.states, { workspaceId }, { initialNumItems: 50 });
  const labels = usePaginatedQuery(api.savedViews.workspaceChoices.labels, { workspaceId }, { initialNumItems: 50 });
  const people = usePaginatedQuery(api.savedViews.workspaceChoices.people, { workspaceId }, { initialNumItems: 50 });
  return (
    <ViewDefinitionForm
      initial={initial}
      onDone={onDone}
      onCancel={onCancel}
      scopeDescription="Saved for this workspace. Each person sees only tasks they can currently access."
      choices={{
        users: people.results.map((person) => ({ id: person.id, label: person.name ?? "Unnamed member" })),
        states: states.results.map((state) => ({ id: state.id, label: `${state.project.identifier} · ${state.name}` })),
        labels: labels.results.map((label) => ({ id: label.id, label: `${label.project.identifier} · ${label.name}` })),
      }}
      taxonomyControls={
        <>
          {(states.status === "LoadingFirstPage" || labels.status === "LoadingFirstPage") && (
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
          </div>
        </>
      }
      peopleControls={
        <>
          {people.status === "LoadingFirstPage" && <p role="status">Loading member choices…</p>}
          {people.status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => people.loadMore(50)}>
              Load more member choices
            </Button>
          )}
        </>
      }
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
