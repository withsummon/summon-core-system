import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { FileAttachmentUpload } from "../tasks/attachments/upload";
import { mutationMessage } from "../commercial/forms";
import { LogoImage } from "./logo-image";

type Appearance = FunctionReturnType<typeof api.settings.logo.get>;
type Confirmation = { operation: "remove" | "restore"; assetId: Id<"assets">; name: string; revision: number };
export function WorkspaceLogo({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const appearance = useQuery(api.settings.logo.get, { workspaceId });
  if (!appearance) return <p role="status">Loading workspace logo…</p>;
  return (
    <section className="space-y-4 rounded-lg border border-subtle p-4">
      <h2 className="text-16 font-semibold">Workspace logo</h2>
      {appearance.logo ? (
        <LogoImage key={appearance.logo.id} logo={appearance.logo} />
      ) : (
        <p className="text-14 text-secondary">No logo uploaded</p>
      )}
      {appearance.canManage && <LogoManager workspaceId={workspaceId} appearance={appearance} />}
    </section>
  );
}
function LogoManager({ workspaceId, appearance }: { workspaceId: Id<"workspaces">; appearance: Appearance }) {
  const prepare = useMutation(api.settings.logo.prepare);
  const remove = useMutation(api.settings.logo.remove);
  const restore = useMutation(api.settings.logo.restore);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-4">
      <FileAttachmentUpload
        label={appearance.logo ? "Replace workspace logo" : "Upload workspace logo"}
        supportedTypes={appearance.supportedTypes}
        prepare={(file) => prepare({ workspaceId, expectedRevision: appearance.revision, ...file })}
      />
      <div className="flex flex-wrap gap-2">
        {appearance.logo && (
          <Button
            variant="secondary"
            onClick={() => {
              setError("");
              setConfirmation({
                operation: "remove",
                assetId: appearance.logo!.id,
                name: appearance.logo!.name,
                revision: appearance.revision,
              });
            }}
          >
            Remove logo
          </Button>
        )}
        <Button variant="secondary" onClick={() => setShowRemoved(!showRemoved)}>
          {showRemoved ? "Hide removed logos" : "Recover a logo"}
        </Button>
      </div>
      {showRemoved && (
        <RemovedLogos
          workspaceId={workspaceId}
          onRestore={(logo) => {
            setError("");
            setConfirmation({ operation: "restore", assetId: logo.id, name: logo.name, revision: appearance.revision });
          }}
        />
      )}
      {confirmation && (
        <div className="space-y-3 rounded-md border border-subtle p-3">
          <p className="text-14 break-words">
            {confirmation.operation === "remove"
              ? `Remove ${confirmation.name}? It can be recovered for seven days.`
              : `Restore ${confirmation.name}? This replaces the current workspace logo, if any.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              loading={pending}
              onClick={() => {
                setPending(true);
                setError("");
                const { operation, name: _name, revision, ...target } = confirmation;
                void (operation === "remove" ? remove : restore)({ workspaceId, ...target, expectedRevision: revision })
                  .then(() => setConfirmation(null))
                  .catch((failure) => setError(mutationMessage(failure)))
                  .finally(() => setPending(false));
              }}
            >
              {confirmation.operation === "remove" ? "Remove logo" : "Restore logo"}
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
function RemovedLogos({
  workspaceId,
  onRestore,
}: {
  workspaceId: Id<"workspaces">;
  onRestore: (logo: FunctionReturnType<typeof api.settings.logo.removed>["page"][number]) => void;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.settings.logo.removed,
    { workspaceId },
    { initialNumItems: 10 }
  );
  return (
    <div className="space-y-2">
      <h3 className="text-14 font-medium">Removed logos</h3>
      {results.map((logo) => (
        <div key={logo.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-14">
          <span className="min-w-0 break-words">
            {logo.name} · Recovery ends {new Date(logo.recoverUntil).toLocaleDateString()}
          </span>
          <Button variant="secondary" onClick={() => onRestore(logo)}>
            Restore
          </Button>
        </div>
      ))}
      {status === "LoadingFirstPage" && <p role="status">Loading removed logos…</p>}
      {status === "Exhausted" && results.length === 0 && <p className="text-14 text-secondary">No removed logos</p>}
      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <Button variant="secondary" loading={status === "LoadingMore"} onClick={() => loadMore(10)}>
          Load more logos
        </Button>
      )}
    </div>
  );
}
