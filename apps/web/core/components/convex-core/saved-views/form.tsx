import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { ProjectLogoPicker } from "@/components/project/create/header";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { mutationMessage } from "../commercial/forms";
import { retainedChoices } from "./choices";
import { BasicFilters, FilterChoices } from "./filters";
type Detail =
  | FunctionReturnType<typeof api.savedViews.index.get>
  | FunctionReturnType<typeof api.savedViews.workspace.get>;
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
  canEdit = true,
}: {
  projectId: Id<"projects">;
  canEdit?: boolean;
  initial: Detail | null;
  onDone: (id: Id<"savedViews">) => void;
  onCancel: () => void;
}) {
  const create = useMutation(api.savedViews.index.create),
    update = useMutation(api.savedViews.index.update);
  const states = useQuery(api.tasks.states.list, { projectId }),
    labels = useQuery(api.tasks.labels.list, { projectId });
  const people = usePaginatedQuery(api.modules.members.choices, { projectId }, { initialNumItems: 50 });
  return (
    <ViewDefinitionForm
      initial={initial}
      canEdit={canEdit}
      onDone={onDone}
      onCancel={onCancel}
      scopeDescription="Saved for this project. Guest visibility follows the project’s feature settings."
      choices={{
        users: people.results.map((person) => ({
          id: person.id,
          label: person.name ?? person.email ?? "Unnamed member",
        })),
        states: (states ?? []).map((state) => ({ id: state._id, label: state.name })),
        labels: (labels ?? []).map((label) => ({ id: label._id, label: label.name })),
      }}
      taxonomyControls={!states || !labels ? <p role="status">Loading project choices…</p> : null}
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
  onSave,
  onDone,
  onCancel,
  choices,
  taxonomyControls,
  peopleControls,
  scopeDescription,
  canEdit,
}: {
  initial: Detail | null;
  onSave: (
    definition: Pick<
      FunctionArgs<typeof api.savedViews.index.create>,
      "name" | "description" | "filters" | "access" | "logoProps"
    >,
    snapshot: Detail | null
  ) => Promise<Id<"savedViews">>;
  onDone: (id: Id<"savedViews">) => void;
  onCancel: () => void;
  choices: {
    users: { id: Id<"users">; label: string }[];
    states: { id: Id<"taskStates">; label: string }[];
    labels: { id: Id<"taskLabels">; label: string }[];
  };
  taxonomyControls: ReactNode;
  peopleControls: ReactNode;
  scopeDescription: string;
  canEdit: boolean;
}) {
  const [snapshot] = useState(initial);
  const [original] = useState<
    Pick<FunctionArgs<typeof api.savedViews.index.create>, "name" | "description" | "filters"> & {
      access: NonNullable<FunctionArgs<typeof api.savedViews.index.create>["access"]>;
      logo: ComponentProps<typeof ProjectLogoPicker>["value"];
    }
  >(() =>
    initial
      ? {
          name: initial.view.name,
          description: initial.view.description,
          filters: initial.view.filters,
          access: initial.view.access,
          logo: initial.logo ?? undefined,
        }
      : {
          name: "",
          description: "",
          filters: emptyFilters,
          access: "public",
          logo: undefined,
        }
  );
  const [draft, setDraft] = useState(original);
  const { name, description, filters, access, logo } = draft;
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const release = useReloadConfirmations(dirty, "This view has unsaved changes.", onCancel, pending);
  const userChoices = retainedChoices(
    choices.users,
    initial?.selections.users ?? [],
    [...filters.assigneeIds, ...filters.creatorIds],
    "Unavailable member"
  );
  const stateChoices = retainedChoices(
    choices.states,
    initial?.selections.states ?? [],
    filters.stateIds,
    "Unavailable state"
  );
  const labelChoices = retainedChoices(
    choices.labels,
    initial?.selections.labels ?? [],
    filters.labelIds,
    "Unavailable label"
  );
  return (
    <form
      className="max-w-4xl space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending || !canEdit) return;
        setPending(true);
        setError("");
        try {
          const data = { name, description, filters, access, logoProps: { ...snapshot?.view.logoProps, ...logo } };
          const id = await onSave(data, snapshot);
          release((allowNavigation) => {
            onCancel();
            if (allowNavigation) onDone(id);
          });
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
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
        <BasicFilters filters={filters} onChange={(value) => setDraft({ ...draft, filters: value })} />
        <details
          className="space-y-3 rounded-md border border-subtle-1 p-3"
          open={filters.stateIds.length + filters.labelIds.length > 0 || undefined}
        >
          <summary className="cursor-pointer text-14 font-medium">States and labels</summary>
          <FilterChoices
            label="Workflow states"
            options={stateChoices}
            selected={filters.stateIds}
            onChange={(stateIds) => setDraft({ ...draft, filters: { ...filters, stateIds } })}
          />
          <FilterChoices
            label="Labels"
            options={labelChoices}
            selected={filters.labelIds}
            onChange={(labelIds) => setDraft({ ...draft, filters: { ...filters, labelIds } })}
          />
          {taxonomyControls}
        </details>
        <details
          className="space-y-3 rounded-md border border-subtle-1 p-3"
          open={filters.assigneeIds.length + filters.creatorIds.length > 0 || undefined}
        >
          <summary className="cursor-pointer text-14 font-medium">Assignees and creators</summary>
          <FilterChoices
            label="Assignees"
            options={userChoices}
            selected={filters.assigneeIds}
            onChange={(assigneeIds) => setDraft({ ...draft, filters: { ...filters, assigneeIds } })}
          />
          <FilterChoices
            label="Creators"
            options={userChoices}
            selected={filters.creatorIds}
            onChange={(creatorIds) => setDraft({ ...draft, filters: { ...filters, creatorIds } })}
          />
          {peopleControls}
        </details>
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
