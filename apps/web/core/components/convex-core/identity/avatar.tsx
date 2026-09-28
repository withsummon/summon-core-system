import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { FileAttachmentUpload } from "../tasks/attachments/upload";
import { mutationMessage } from "../commercial/forms";
import { AuthenticatedAssetImage } from "../assets/image";

type Appearance = FunctionReturnType<typeof api.identity.avatar.get>;
type Confirmation = { operation: "remove" | "restore"; assetId: Id<"assets">; name: string; revision: number };
export function UserAvatar() {
  const appearance = useQuery(api.identity.avatar.get, {});
  if (!appearance) return <p role="status">Loading avatar…</p>;
  return (
    <section className="space-y-4 rounded-lg border border-subtle p-4">
      <h2 className="text-16 font-semibold">Profile photo</h2>
      {appearance.avatar ? (
        <AuthenticatedAssetImage
          key={appearance.avatar.id}
          asset={appearance.avatar}
          alt="Profile photo"
          className="h-20 w-20 rounded-md border border-subtle object-cover"
        />
      ) : (
        <p className="text-14 text-secondary">No avatar uploaded</p>
      )}
      <AvatarManager appearance={appearance} />
    </section>
  );
}
function AvatarManager({ appearance }: { appearance: Appearance }) {
  const prepare = useMutation(api.identity.avatar.prepare);
  const remove = useMutation(api.identity.avatar.remove);
  const restore = useMutation(api.identity.avatar.restore);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-4">
      <FileAttachmentUpload
        label={appearance.avatar ? "Replace avatar" : "Upload avatar"}
        supportedTypes={appearance.supportedTypes}
        prepare={(file) => prepare({ slot: "avatar", expectedRevision: appearance.revision, ...file })}
      />
      <div className="flex flex-wrap gap-2">
        {appearance.avatar && (
          <Button
            variant="secondary"
            onClick={() => {
              setError("");
              setConfirmation({
                operation: "remove",
                assetId: appearance.avatar!.id,
                name: appearance.avatar!.name,
                revision: appearance.revision,
              });
            }}
          >
            Remove avatar
          </Button>
        )}
        <Button variant="secondary" onClick={() => setShowRemoved(!showRemoved)}>
          {showRemoved ? "Hide removed avatars" : "Recover an avatar"}
        </Button>
      </div>
      {showRemoved && (
        <RemovedAvatars
          onRestore={(avatar) => {
            setError("");
            setConfirmation({
              operation: "restore",
              assetId: avatar.id,
              name: avatar.name,
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
              : `Restore ${confirmation.name}? This replaces the current avatar, if any.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              loading={pending}
              onClick={() => {
                setPending(true);
                setError("");
                const { operation, name: _name, revision, ...target } = confirmation;
                void (operation === "remove" ? remove : restore)({
                  slot: "avatar",
                  ...target,
                  expectedRevision: revision,
                })
                  .then(() => setConfirmation(null))
                  .catch((failure) => setError(mutationMessage(failure)))
                  .finally(() => setPending(false));
              }}
            >
              {confirmation.operation === "remove" ? "Remove avatar" : "Restore avatar"}
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
function RemovedAvatars({
  onRestore,
}: {
  onRestore: (avatar: FunctionReturnType<typeof api.identity.avatar.removed>["page"][number]) => void;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.identity.avatar.removed,
    { slot: "avatar" },
    { initialNumItems: 10 }
  );
  return (
    <div className="space-y-2">
      <h3 className="text-14 font-medium">Removed avatars</h3>
      {results.map((avatar) => (
        <div key={avatar.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-14">
          <span className="min-w-0 break-words">
            {avatar.name} · Recovery ends {new Date(avatar.recoverUntil).toLocaleDateString()}
          </span>
          <Button variant="secondary" onClick={() => onRestore(avatar)}>
            Restore
          </Button>
        </div>
      ))}
      {status === "LoadingFirstPage" && <p role="status">Loading removed avatars…</p>}
      {status === "Exhausted" && results.length === 0 && <p className="text-14 text-secondary">No removed avatars</p>}
      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <Button variant="secondary" loading={status === "LoadingMore"} onClick={() => loadMore(10)}>
          Load more avatars
        </Button>
      )}
    </div>
  );
}
