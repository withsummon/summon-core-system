import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { FileAttachmentUpload } from "../tasks/attachments/upload";
import { mutationMessage } from "../commercial/forms";
import { AuthenticatedAssetImage } from "../assets/image";

type Appearance = FunctionReturnType<typeof api.projects.cover.get>;
type Confirmation = { operation: "remove" | "restore"; assetId: Id<"assets">; name: string; revision: number };
export function ProjectCover({ projectId }: { projectId: Id<"projects"> }) {
  const appearance = useQuery(api.projects.cover.get, { projectId });
  if (!appearance) return <p role="status">Loading project cover…</p>;
  return (
    <section className="space-y-4 rounded-lg border border-subtle p-4">
      <h2 className="text-16 font-semibold">Project cover</h2>
      {appearance.cover ? (
        <AuthenticatedAssetImage
          key={appearance.cover.id}
          asset={appearance.cover}
          alt="Project cover"
          className="h-32 w-full rounded-md border border-subtle object-cover"
        />
      ) : (
        <p className="text-14 text-secondary">No cover uploaded</p>
      )}
      {appearance.canManage && <CoverManager projectId={projectId} appearance={appearance} />}
    </section>
  );
}
function CoverManager({ projectId, appearance }: { projectId: Id<"projects">; appearance: Appearance }) {
  const prepare = useMutation(api.projects.cover.prepare);
  const remove = useMutation(api.projects.cover.remove);
  const restore = useMutation(api.projects.cover.restore);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-4">
      <FileAttachmentUpload
        label={appearance.cover ? "Replace project cover" : "Upload project cover"}
        supportedTypes={appearance.supportedTypes}
        prepare={(file) => prepare({ projectId, expectedRevision: appearance.revision, ...file })}
      />
      <div className="flex flex-wrap gap-2">
        {appearance.cover && (
          <Button
            variant="secondary"
            onClick={() => {
              setError("");
              setConfirmation({
                operation: "remove",
                assetId: appearance.cover!.id,
                name: appearance.cover!.name,
                revision: appearance.revision,
              });
            }}
          >
            Remove cover
          </Button>
        )}
        <Button variant="secondary" onClick={() => setShowRemoved(!showRemoved)}>
          {showRemoved ? "Hide removed covers" : "Recover a cover"}
        </Button>
      </div>
      {showRemoved && (
        <RemovedCovers
          projectId={projectId}
          onRestore={(cover) => {
            setError("");
            setConfirmation({
              operation: "restore",
              assetId: cover.id,
              name: cover.name,
              revision: appearance.revision,
            });
          }}
        />
      )}
      {confirmation && (
        <div className="space-y-3 rounded-md border border-subtle p-3">
          <p className="text-14 break-words">
            {confirmation.operation === "remove"
              ? `Remove ${confirmation.name}? It can be recovered for seven days.`
              : `Restore ${confirmation.name}? This replaces the current project cover, if any.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              loading={pending}
              onClick={() => {
                setPending(true);
                setError("");
                const { operation, name: _name, revision, ...target } = confirmation;
                void (operation === "remove" ? remove : restore)({ projectId, ...target, expectedRevision: revision })
                  .then(() => setConfirmation(null))
                  .catch((failure) => setError(mutationMessage(failure)))
                  .finally(() => setPending(false));
              }}
            >
              {confirmation.operation === "remove" ? "Remove cover" : "Restore cover"}
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setConfirmation(null);
                setError("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </div>
  );
}
function RemovedCovers({
  projectId,
  onRestore,
}: {
  projectId: Id<"projects">;
  onRestore: (cover: FunctionReturnType<typeof api.projects.cover.removed>["page"][number]) => void;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.projects.cover.removed,
    { projectId },
    { initialNumItems: 10 }
  );
  return (
    <div className="space-y-2">
      <h3 className="text-14 font-medium">Removed covers</h3>
      {results.map((cover) => (
        <div key={cover.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-14">
          <span className="min-w-0 break-words">
            {cover.name} · Recovery ends {new Date(cover.recoverUntil).toLocaleDateString()}
          </span>
          <Button variant="secondary" onClick={() => onRestore(cover)}>
            Restore
          </Button>
        </div>
      ))}
      {status === "LoadingFirstPage" && <p role="status">Loading removed covers…</p>}
      {status === "Exhausted" && results.length === 0 && <p className="text-14 text-secondary">No removed covers</p>}
      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <Button variant="secondary" loading={status === "LoadingMore"} onClick={() => loadMore(10)}>
          Load more covers
        </Button>
      )}
    </div>
  );
}

export function ProjectCoverHeader({ projectId }: { projectId: Id<"projects"> }) {
  const appearance = useQuery(api.projects.cover.get, { projectId });
  if (!appearance?.cover) return null;
  return (
    <AuthenticatedAssetImage
      key={appearance.cover.id}
      asset={appearance.cover}
      alt="Project cover"
      className="h-24 w-full rounded-md object-cover sm:h-32"
    />
  );
}
