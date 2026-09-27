import { Component, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Doc } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage, selectClass } from "../commercial/forms";
type Destination = FunctionReturnType<typeof api.documents.hierarchy.choices>["page"][number];
function documentRoute(workspace: string, document: string) {
  return `/core?${new URLSearchParams({ workspace, module: "documents", document })}`;
}
export function DocumentHierarchy({
  document,
  canWrite,
  workspaceSlug,
}: {
  document: Doc<"documents">;
  canWrite: boolean;
  workspaceSlug: string;
}) {
  const parent = useQuery(api.documents.hierarchy.parent, { documentId: document._id });
  const children = usePaginatedQuery(
    api.documents.hierarchy.children,
    { documentId: document._id },
    { initialNumItems: 30 }
  );
  const [moving, setMoving] = useState(false);
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-16 font-medium">Document hierarchy</h2>
        {canWrite && (
          <Button variant="secondary" onClick={() => setMoving(true)}>
            Move document
          </Button>
        )}
      </header>
      <p className="text-14">
        Parent:{" "}
        {parent === undefined ? (
          "Loading…"
        ) : parent.parent ? (
          <Link className="text-accent-primary" to={documentRoute(workspaceSlug, parent.parent.id)}>
            {parent.parent.name || "Untitled"}
            {parent.parent.archived ? " (archived)" : ""}
          </Link>
        ) : parent.hasParent ? (
          "Unavailable"
        ) : (
          "Top level"
        )}
      </p>
      <h3 className="text-14 font-medium">Child documents</h3>
      <ul className="space-y-2">
        {children.results.map((child) => (
          <li key={child._id}>
            <Link
              className="block rounded-md border border-subtle-1 p-3 text-14 hover:bg-layer-2"
              to={documentRoute(workspaceSlug, child._id)}
            >
              {child.name || "Untitled"}
              {child.archived ? " · Archived" : ""}
              {child.isLocked ? " · Locked" : ""}
            </Link>
          </li>
        ))}
      </ul>
      {children.status === "LoadingFirstPage" && (
        <p role="status" className="text-14">
          Loading child documents…
        </p>
      )}
      {children.status === "Exhausted" && children.results.length === 0 && (
        <p className="text-14 text-secondary">No child documents visible to you.</p>
      )}
      {children.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => children.loadMore(30)}>
          Load more child documents
        </Button>
      )}
      {moving && <MoveDocument document={document} onClose={() => setMoving(false)} />}
    </section>
  );
}
function MoveDocument({ document, onClose }: { document: Doc<"documents">; onClose: () => void }) {
  const [snapshot] = useState(document);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const move = useMutation(api.documents.hierarchy.move);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <Dialog.Panel width={EDialogWidth.LG}>
        <form
          className="space-y-4 p-4 sm:p-6"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            try {
              await move({
                documentId: snapshot._id,
                expectedUpdatedAt: snapshot.updatedAt,
                parentId: destination?.id ?? null,
                expectedParentUpdatedAt: destination?.updatedAt ?? null,
              });
              onClose();
            } catch (failure) {
              setError(mutationMessage(failure));
            } finally {
              setPending(false);
            }
          }}
        >
          <Dialog.Title className="text-20 font-semibold">Move {snapshot.name || "document"}</Dialog.Title>
          <p className="text-14 text-secondary">
            Moving changes its parent. Document visibility and its child documents' access stay the same.
          </p>
          <fieldset disabled={pending} className="space-y-3">
            <DestinationBoundary>
              <DestinationPicker documentId={snapshot._id} value={destination} onChange={setDestination} />
            </DestinationBoundary>
            <p className="text-14">Destination: {destination?.name || "Top level"}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={pending}>
                Confirm move
              </Button>
              <Button variant="secondary" onClick={onClose}>
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
      </Dialog.Panel>
    </Dialog>
  );
}
function DestinationPicker({
  documentId,
  value,
  onChange,
}: {
  documentId: Doc<"documents">["_id"];
  value: Destination | null;
  onChange: (value: Destination | null) => void;
}) {
  const rows = usePaginatedQuery(api.documents.hierarchy.choices, { documentId }, { initialNumItems: 30 });
  return (
    <div className="space-y-2">
      <SummonField label="Parent document" htmlFor="document-parent">
        <select
          id="document-parent"
          className={selectClass}
          value={value?.id ?? ""}
          onChange={(event) => {
            if (!event.target.value) onChange(null);
            else {
              const found = rows.results.find((row) => row.id === event.target.value);
              if (found) onChange(found);
            }
          }}
        >
          <option value="">Top level (no parent)</option>
          {value && !rows.results.some((row) => row.id === value.id) && (
            <option value={value.id}>{value.name} · Unavailable or not loaded</option>
          )}
          {rows.results.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name || "Untitled"}
            </option>
          ))}
        </select>
      </SummonField>
      {rows.status === "LoadingFirstPage" && (
        <p role="status" className="text-12">
          Loading destinations…
        </p>
      )}
      {rows.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => rows.loadMore(30)}>
          Load more destinations
        </Button>
      )}
    </div>
  );
}
class DestinationBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert" className="text-14">
        Destinations are unavailable. Your chosen destination is kept; close and reopen to refresh.
      </p>
    ) : (
      this.props.children
    );
  }
}
