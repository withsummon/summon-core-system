import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { useSearchParams } from "react-router";
import { api } from "@summon/convex/api";
import type { Doc } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { mutationMessage } from "../commercial/forms";

export function DuplicateDocument({ document }: { document: Doc<"documents"> }) {
  const availability = useQuery(api.documents.copy.availability, { documentId: document._id });
  const [, setParams] = useSearchParams();
  const [copying, setCopying] = useState(false);
  if (!availability) return null;
  return (
    <>
      <Button
        variant="secondary"
        disabled={!availability.canCopy}
        title={availability.reason ?? undefined}
        onClick={() => setCopying(true)}
      >
        Duplicate document
      </Button>
      {copying && (
        <DuplicateDocumentDialog
          document={document}
          onClose={() => setCopying(false)}
          onCopied={(id) =>
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.set("document", id);
              return next;
            })
          }
        />
      )}
    </>
  );
}

export function DuplicateDocumentDialog({
  document,
  onClose,
  onCopied,
}: {
  document: Doc<"documents">;
  onClose: () => void;
  onCopied: (id: Doc<"documents">["_id"]) => void;
}) {
  const availability = useQuery(api.documents.copy.availability, { documentId: document._id });
  const copy = useAction(api.documents.copyActions.run);
  const [request] = useState<FunctionArgs<typeof api.documents.copyActions.run>>(() => ({
    documentId: document._id,
    expectedRevision: document.revision,
    expectedUpdatedAt: document.updatedAt,
    requestId: crypto.randomUUID(),
  }));
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const release = useReloadConfirmations(pending, "A page copy is still running.", undefined, pending);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <Dialog.Panel width={EDialogWidth.LG} className="space-y-3 p-4 text-14 sm:p-6">
        <Dialog.Title className="text-20 font-semibold">Make a copy</Dialog.Title>
        <p>
          Create an independent copy of this document and its images? It keeps the current visibility, projects, parent,
          lock and archive state. Labels, subpages and version history are not copied.
        </p>
        <p className="text-12 text-secondary">
          Supports up to 100 images and 32 MiB. If interrupted, Retry copy resumes this request.
        </p>
        {(error || availability?.reason) && (
          <p role="alert" className="text-danger-primary">
            {error || availability?.reason}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            loading={pending}
            disabled={pending || !availability?.canCopy}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                const id = await copy(request);
                release((allow) => {
                  onClose();
                  if (allow) onCopied(id);
                });
              } catch (failure) {
                setError(mutationMessage(failure));
              } finally {
                setPending(false);
              }
            }}
          >
            {error ? "Retry copy" : "Create copy"}
          </Button>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
