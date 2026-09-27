import { useState } from "react";
import { useAction, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Doc, Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { TaskRichEditor } from "../tasks/rich-editor";
import { mutationMessage } from "../commercial/forms";
type Preview = FunctionReturnType<typeof api.documents.historyActions.preview>;
export function DocumentHistory({ document, canWrite }: { document: Doc<"documents">; canWrite: boolean }) {
  const history = usePaginatedQuery(api.documents.history.list, { documentId: document._id }, { initialNumItems: 10 });
  const preview = useAction(api.documents.historyActions.preview),
    restore = useAction(api.documents.historyActions.restore);
  const [selected, setSelected] = useState<Preview | null>(null),
    [pending, setPending] = useState(false),
    [confirming, setConfirming] = useState(false),
    [error, setError] = useState("");
  async function open(versionId: Id<"documentRevisions">) {
    setPending(true);
    setError("");
    try {
      setSelected(await preview({ documentId: document._id, versionId }));
      setConfirming(false);
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-4">
      <h2 className="text-16 font-medium">Version history</h2>
      <ul className="space-y-2">
        {history.results.map((version) => (
          <li key={version.id}>
            <Button variant="secondary" disabled={pending} onClick={() => open(version.id)}>
              Revision {version.revision} · {new Date(version.createdAt).toLocaleString()}
            </Button>
          </li>
        ))}
      </ul>
      {history.status === "LoadingFirstPage" && <p role="status">Loading history…</p>}
      {history.status === "Exhausted" && history.results.length === 0 && (
        <p className="text-14 text-secondary">No saved versions yet.</p>
      )}
      {history.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => history.loadMore(10)}>
          Load more versions
        </Button>
      )}
      {pending && <p role="status">Working with document history…</p>}
      {selected && (
        <div className="space-y-3 rounded-md border border-subtle-1 p-3">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-16 font-medium">Revision {selected.revision}</h3>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setSelected(null);
                setConfirming(false);
              }}
            >
              Close preview
            </Button>
          </header>
          <p className="text-14 text-secondary">Historical title: {selected.title || "Untitled"}</p>
          <TaskRichEditor
            key={selected.versionId}
            id={`document-history-${selected.versionId}`}
            label="Historical document content"
            html={selected.html}
            placeholder="Empty document"
            editable={false}
          />
          {canWrite && (
            <Button disabled={pending} variant="secondary" onClick={() => setConfirming(true)}>
              Restore body from this version
            </Button>
          )}
          {confirming && (
            <div className="space-y-2 border-t border-subtle-1 pt-3">
              <p className="text-14">
                Replace the current body with revision {selected.revision}? The current title stays unchanged. This
                creates a new version; later content remains available in history.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!canWrite}
                  loading={pending}
                  onClick={async () => {
                    setPending(true);
                    setError("");
                    try {
                      await restore({
                        documentId: document._id,
                        versionId: selected.versionId,
                        expectedRevision: selected.currentRevision,
                        expectedUpdatedAt: selected.currentUpdatedAt,
                      });
                      setConfirming(false);
                      setSelected(null);
                    } catch (failure) {
                      setError(mutationMessage(failure));
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Confirm body restore
                </Button>
                <Button variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
