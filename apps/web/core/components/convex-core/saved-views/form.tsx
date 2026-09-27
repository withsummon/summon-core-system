import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
import { retainedChoices } from "./choices";
import { BasicFilters, FilterChoices } from "./filters";
type Detail = FunctionReturnType<typeof api.savedViews.index.get>;
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
export function SavedViewForm({
  projectId,
  initial,
  onDone,
  onCancel,
}: {
  projectId: Id<"projects">;
  initial: Detail | null;
  onDone: (id: Id<"savedViews">) => void;
  onCancel: () => void;
}) {
  const [snapshot] = useState(initial);
  const [name, setName] = useState(initial?.view.name ?? ""),
    [description, setDescription] = useState(initial?.view.description ?? "");
  const [filters, setFilters] = useState(initial?.view.filters ?? emptyFilters);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const create = useMutation(api.savedViews.index.create),
    update = useMutation(api.savedViews.index.update);
  const states = useQuery(api.tasks.states.list, { projectId }),
    labels = useQuery(api.tasks.labels.list, { projectId });
  const people = usePaginatedQuery(api.modules.members.choices, { projectId }, { initialNumItems: 50 });
  const userChoices = retainedChoices(
    people.results.map((person) => ({ id: person.id, label: person.name ?? person.email ?? "Unnamed member" })),
    snapshot?.selections.users ?? [],
    [...filters.assigneeIds, ...filters.creatorIds],
    "Unavailable member"
  );
  const stateChoices = retainedChoices(
    (states ?? []).map((state) => ({ id: state._id, label: state.name })),
    snapshot?.selections.states ?? [],
    filters.stateIds,
    "Unavailable state"
  );
  const labelChoices = retainedChoices(
    (labels ?? []).map((label) => ({ id: label._id, label: label.name })),
    snapshot?.selections.labels ?? [],
    filters.labelIds,
    "Unavailable label"
  );
  return (
    <form
      className="max-w-4xl space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          const data = { name, description, filters };
          if (snapshot) {
            await update({ ...data, viewId: snapshot.view._id, expectedUpdatedAt: snapshot.view.updatedAt });
            onDone(snapshot.view._id);
          } else {
            onDone(await create({ ...data, projectId }));
          }
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-24 font-semibold">{snapshot ? "Edit saved view" : "Create saved view"}</h2>
      <fieldset disabled={pending} className="space-y-4">
        <SummonField label="View name">
          <Input required maxLength={255} value={name} onChange={(event) => setName(event.target.value)} />
        </SummonField>
        <SummonField label="View description" htmlFor="saved-view-description">
          <textarea
            id="saved-view-description"
            className="w-full rounded-md border border-subtle-1 bg-layer-2 p-2 text-14"
            rows={2}
            maxLength={10000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </SummonField>
        <p className="text-14 text-secondary">
          Saved for this project. Guest visibility follows the project’s feature settings.
        </p>
        <BasicFilters filters={filters} onChange={setFilters} />
        <details
          className="space-y-3 rounded-md border border-subtle-1 p-3"
          open={filters.stateIds.length > 0 || filters.labelIds.length > 0 || undefined}
        >
          <summary className="cursor-pointer text-14 font-medium">States and labels</summary>
          <FilterChoices
            label="Workflow states"
            options={stateChoices}
            selected={filters.stateIds}
            onChange={(stateIds) => setFilters({ ...filters, stateIds })}
          />
          <FilterChoices
            label="Labels"
            options={labelChoices}
            selected={filters.labelIds}
            onChange={(labelIds) => setFilters({ ...filters, labelIds })}
          />
          {(!states || !labels) && <p role="status">Loading project choices…</p>}
        </details>
        <details
          className="space-y-3 rounded-md border border-subtle-1 p-3"
          open={filters.assigneeIds.length > 0 || filters.creatorIds.length > 0 || undefined}
        >
          <summary className="cursor-pointer text-14 font-medium">Assignees and creators</summary>
          <FilterChoices
            label="Assignees"
            options={userChoices}
            selected={filters.assigneeIds}
            onChange={(assigneeIds) => setFilters({ ...filters, assigneeIds })}
          />
          <FilterChoices
            label="Creators"
            options={userChoices}
            selected={filters.creatorIds}
            onChange={(creatorIds) => setFilters({ ...filters, creatorIds })}
          />
          {people.status === "LoadingFirstPage" && <p role="status">Loading member choices…</p>}
          {people.status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => people.loadMore(50)}>
              Load more member choices
            </Button>
          )}
        </details>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            Save view
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
