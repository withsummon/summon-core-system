import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";

export function DocumentTrash({ workspaceId, canRestore }: { workspaceId: Id<"workspaces">; canRestore: boolean }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.documents.lifecycle.trash,
    { workspaceId },
    { initialNumItems: 50 }
  );
  return (
    <section className="space-y-4" aria-label="Deleted documents">
      <p className="text-14 text-secondary">Your deleted documents retain their content and previous visibility.</p>
      {status === "LoadingFirstPage" && <p role="status">Loading Trash…</p>}
      {results.map((document) => (
        <TrashRow key={document._id} document={document} canRestore={canRestore} />
      ))}
      {status === "Exhausted" && !results.length && <p className="text-14 text-secondary">Your Trash is empty.</p>}
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(50)}>
          Load more deleted documents
        </Button>
      )}
    </section>
  );
}

function TrashRow({ document, canRestore }: { document: Doc<"documents">; canRestore: boolean }) {
  const restore = useMutation(api.documents.lifecycle.restore);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <article className="rounded-lg border border-subtle-1 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-16 font-medium break-words">{document.name || "Untitled"}</h2>
          <p className="text-12 text-secondary">
            {document.access === "private" ? "Private" : document.isGlobal ? "Workspace" : "Selected projects"}
            {document.isLocked ? " · Locked" : ""}
            {document.archived ? " · Archived" : ""}
          </p>
        </div>
        {canRestore && (
          <Button
            variant="secondary"
            loading={pending}
            aria-label={`Restore ${document.name || "Untitled"}`}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await restore({ documentId: document._id, expectedUpdatedAt: document.updatedAt });
              } catch (failure) {
                setError(mutationMessage(failure));
                setPending(false);
              }
            }}
          >
            Restore
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-14 text-danger-primary">
          {error}
        </p>
      )}
    </article>
  );
}
