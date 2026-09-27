import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { useSearchParams } from "react-router";
import { api } from "@summon/convex/api";
import type { Doc } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";

export function DuplicateDocument({ document }: { document: Doc<"documents"> }) {
  const availability = useQuery(api.documents.copy.availability, { documentId: document._id });
  const run = useAction(api.documents.copyActions.run);
  const [, setParams] = useSearchParams();
  const [request, setRequest] = useState<FunctionArgs<typeof api.documents.copyActions.run> | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  if (!availability) return null;
  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        disabled={!availability.canCopy || pending}
        title={availability.reason ?? undefined}
        onClick={() => {
          setRequest({
            documentId: document._id,
            expectedRevision: document.revision,
            expectedUpdatedAt: document.updatedAt,
            requestId: crypto.randomUUID(),
          });
          setError("");
        }}
      >
        Duplicate document
      </Button>
      {request && (
        <div className="max-w-xl space-y-3 rounded-md border border-subtle-1 bg-layer-1 p-3 text-14">
          <p>
            Create an independent copy of this document and its images? It keeps the current visibility, projects,
            parent, lock and archive state. Labels, subpages and version history are not copied.
          </p>
          <p className="text-12 text-secondary">
            Supports up to 100 images and 32 MiB. If interrupted, Retry copy resumes this request.
          </p>
          {error && (
            <p role="alert" className="text-danger-primary">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              loading={pending}
              disabled={!availability.canCopy}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  const id = await run(request);
                  setParams((current) => {
                    const next = new URLSearchParams(current);
                    next.set("document", id);
                    return next;
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
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setRequest(null);
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
