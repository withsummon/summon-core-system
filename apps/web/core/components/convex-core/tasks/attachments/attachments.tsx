import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../../commercial/forms";
import { AttachmentDownload } from "./download";
import { AttachmentUpload } from "./upload";
type Attachment = FunctionReturnType<typeof api.assets.taskAttachments.list>["page"][number];
export function TaskAttachments({ taskId }: { taskId: Id<"tasks"> }) {
  const access = useQuery(api.assets.taskAttachments.access, { taskId });
  const [deleted, setDeleted] = useState(false);
  const files = usePaginatedQuery(api.assets.taskAttachments.list, { taskId, deleted }, { initialNumItems: 30 });
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-16 font-medium">Attachments</h3>
        <div className="flex gap-2">
          <Button variant={!deleted ? "primary" : "secondary"} onClick={() => setDeleted(false)}>
            Files
          </Button>
          <Button variant={deleted ? "primary" : "secondary"} onClick={() => setDeleted(true)}>
            Removed files
          </Button>
        </div>
      </header>
      {access?.canUpload && !deleted && <AttachmentUpload key={taskId} taskId={taskId} />}
      <ul className="divide-y divide-subtle-1">
        {files.results.map((file) => (
          <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-14 font-medium break-all">{file.name}</p>
              <p className="text-12 text-secondary">
                {file.contentType} · {(file.size / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB
              </p>
              {deleted && file.restoreUntil !== null && (
                <p className="text-12 text-secondary">
                  Recovery expires {new Date(file.restoreUntil).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!deleted && <AttachmentDownload taskId={taskId} assetId={file.id} name={file.name} />}
              <AttachmentLifecycle taskId={taskId} file={file} />
            </div>
          </li>
        ))}
      </ul>
      {files.status === "LoadingFirstPage" && <p role="status">Loading attachments…</p>}
      {files.status === "Exhausted" && !files.results.length && (
        <p className="text-14 text-secondary">{deleted ? "No removed files available." : "No attachments yet."}</p>
      )}
      {files.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => files.loadMore(30)}>
          Load more attachments
        </Button>
      )}
    </section>
  );
}
function AttachmentLifecycle({ taskId, file }: { taskId: Id<"tasks">; file: Attachment }) {
  const change = useMutation(api.assets.taskAttachments.change);
  const [snapshot, setSnapshot] = useState<Attachment | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  if (!file.canRemove && !file.canRestore) return null;
  return (
    <div className="space-y-2">
      {snapshot ? (
        <>
          <p className="text-14">
            {snapshot.canRestore
              ? `Restore ${snapshot.name}?`
              : `Remove ${snapshot.name}? File recovery is available for seven days.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await change({
                    taskId,
                    assetId: snapshot.id,
                    expectedRevision: snapshot.revision,
                    deleted: !snapshot.canRestore,
                  });
                  setSnapshot(null);
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              {snapshot.canRestore ? "Confirm restore file" : "Confirm remove file"}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setSnapshot(null)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setError("");
            setSnapshot(file);
          }}
        >
          {file.canRestore ? "Restore file" : "Remove file"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
