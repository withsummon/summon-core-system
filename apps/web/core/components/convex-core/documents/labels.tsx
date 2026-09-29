import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { usePaginatedQuery as useLabelPages } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import type { Doc, Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage, selectClass } from "../commercial/forms";
type Choice = FunctionReturnType<typeof api.savedViews.workspaceChoices.labels>["page"][number];
export function DocumentLabels({ document, canWrite }: { document: Doc<"documents">; canWrite: boolean }) {
  const rows = usePaginatedQuery(api.documents.labels.list, { documentId: document._id }, { initialNumItems: 30 });
  const [action, setAction] = useState<{
    labelId: Id<"taskLabels">;
    name: string;
    assigned: boolean;
    updatedAt: number;
  } | null>(null);
  const [adding, setAdding] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const change = useMutation(api.documents.labels.set);
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-4">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-16 font-medium">Labels</h2>
        {canWrite && (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            Add label
          </Button>
        )}
      </header>
      <ul className="space-y-2">
        {rows.results.map((row) => (
          <li key={row.labelId} className="flex flex-wrap items-center justify-between gap-2 text-14">
            <span>{row.label ? `${row.label.name} · ${row.label.project.identifier}` : "Unavailable label"}</span>
            {canWrite && (
              <Button
                variant="secondary"
                onClick={() => {
                  setError("");
                  setAction({
                    labelId: row.labelId,
                    name: row.label?.name ?? "Unavailable label",
                    assigned: false,
                    updatedAt: document.updatedAt,
                  });
                }}
              >
                Remove label
              </Button>
            )}
          </li>
        ))}
      </ul>
      {rows.status === "LoadingFirstPage" && <p role="status">Loading labels…</p>}
      {rows.status === "Exhausted" && rows.results.length === 0 && <p className="text-14 text-secondary">No labels</p>}
      {rows.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => rows.loadMore(30)}>
          Load more labels
        </Button>
      )}
      {adding && (
        <AddLabel
          key={document._id}
          document={document}
          onCancel={() => setAdding(false)}
          onSelect={(choice, updatedAt) => {
            setError("");
            setAction({ labelId: choice.id, name: choice.name, assigned: true, updatedAt });
            setAdding(false);
          }}
        />
      )}
      {action && (
        <div className="space-y-2 rounded-md border border-subtle-1 p-3">
          <p className="text-14">
            {action.assigned ? "Add" : "Remove"} {action.name}?
          </p>
          <div className="flex gap-2">
            <Button
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await change({
                    documentId: document._id,
                    labelId: action.labelId,
                    assigned: action.assigned,
                    expectedUpdatedAt: action.updatedAt,
                  });
                  setAction(null);
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Confirm {action.assigned ? "add" : "removal"}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setAction(null)}>
              Cancel
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-14 text-danger-primary">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
function AddLabel({
  document,
  onSelect,
  onCancel,
}: {
  document: Doc<"documents">;
  onSelect: (choice: Choice, updatedAt: number) => void;
  onCancel: () => void;
}) {
  const [snapshot] = useState(document);
  const [selected, setSelected] = useState<Choice | null>(null);
  const choices = useLabelPages(
    api.savedViews.workspaceChoices.labels,
    { workspaceId: document.workspaceId },
    { initialNumItems: 30 }
  );
  return (
    <div className="space-y-3 rounded-md border border-subtle-1 p-3">
      <SummonField label="Project label" htmlFor="document-label">
        <select
          id="document-label"
          className={selectClass}
          value={selected?.id ?? ""}
          onChange={(event) => setSelected(choices.results.find((row) => row.id === event.target.value) ?? null)}
        >
          <option value="">Select label</option>
          {selected && !choices.results.some((row) => row.id === selected.id) && (
            <option value={selected.id}>Unavailable selection</option>
          )}
          {choices.results.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name} · {row.project.identifier}
            </option>
          ))}
        </select>
      </SummonField>
      {choices.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => choices.loadMore(30)}>
          Load more project labels
        </Button>
      )}
      <div className="flex gap-2">
        <Button
          disabled={!selected}
          onClick={() => {
            if (selected) onSelect(selected, snapshot.updatedAt);
          }}
        >
          Continue
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
