import { Component, useState } from "react";
import type { ReactNode } from "react";
import { useConvex, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { AttachmentRows } from "../attachments/attachments";
import { FileAttachmentUpload } from "../attachments/upload";
import { FileAttachmentDownload } from "../attachments/download";
import { mutationMessage } from "../../commercial/forms";
export function DraftAttachments({ draftId }: { draftId: Id<"taskDrafts"> }) {
  return (
    <AttachmentBoundary key={draftId}>
      <DraftAttachmentContent draftId={draftId} />
    </AttachmentBoundary>
  );
}
function DraftAttachmentContent({ draftId }: { draftId: Id<"taskDrafts"> }) {
  const access = useQuery(api.assets.draftAttachments.access, { draftId });
  const [deleted, setDeleted] = useState(false);
  const files = usePaginatedQuery(api.assets.draftAttachments.list, { draftId, deleted }, { initialNumItems: 30 });
  const uploads = useQuery(api.assets.draftAttachments.pending, { draftId });
  const prepare = useMutation(api.assets.draftAttachments.prepare),
    change = useMutation(api.assets.draftAttachments.change);
  const client = useConvex();
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-16 font-medium">Draft attachments</h3>
        <div className="flex gap-2">
          <Button variant={!deleted ? "primary" : "secondary"} onClick={() => setDeleted(false)}>
            Files
          </Button>
          <Button variant={deleted ? "primary" : "secondary"} onClick={() => setDeleted(true)}>
            Removed files
          </Button>
        </div>
      </header>
      {access?.canUpload && (
        <div hidden={deleted}>
          <FileAttachmentUpload key={draftId} prepare={(file) => prepare({ draftId, ...file })} />
        </div>
      )}
      {uploads && uploads.length > 0 && (
        <section className="space-y-2" aria-label="Pending draft uploads">
          <p className="text-14 text-secondary">Finish uploads or cancel their reservations before publishing.</p>
          {uploads.map((upload) => (
            <PendingUpload key={upload.id} draftId={draftId} assetId={upload.id} name={upload.name} />
          ))}
        </section>
      )}
      <AttachmentRows
        files={files.results}
        deleted={deleted}
        renderDownload={(file) => (
          <FileAttachmentDownload
            name={file.name}
            resolveFile={() => client.query(api.assets.index.get, { assetId: file.id })}
          />
        )}
        change={(args) => change({ draftId, ...args })}
      />
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
function PendingUpload({ draftId, assetId, name }: { draftId: Id<"taskDrafts">; assetId: Id<"assets">; name: string }) {
  const cancel = useMutation(api.assets.draftAttachments.cancelUpload);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 text-14 break-all">{name}</span>
        <Button
          variant="secondary"
          loading={pending}
          onClick={async () => {
            setPending(true);
            setError("");
            try {
              await cancel({ draftId, assetId });
            } catch (failure) {
              setError(mutationMessage(failure));
            } finally {
              setPending(false);
            }
          }}
        >
          Cancel pending upload
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
class AttachmentBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert" className="text-14 text-secondary">
        Draft attachments are unavailable. Your text draft is preserved.
      </p>
    ) : (
      this.props.children
    );
  }
}
