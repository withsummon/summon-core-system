import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { mutationMessage } from "../commercial/forms";
import { TaskDescriptionEditor } from "./description-editor";
type Scope = FunctionArgs<typeof api.tasks.history.list>["scope"];
type Capabilities = FunctionReturnType<typeof api.tasks.history.capabilities>;
export function DescriptionHistory({ scope }: { scope: Scope }) {
  const capabilities = useQuery(api.tasks.history.capabilities, { scope });
  const [open, setOpen] = useState(false);
  if (!capabilities?.canRead) return null;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Description history
      </Button>
      {open && (
        <Dialog open onOpenChange={setOpen}>
          <Dialog.Panel width={EDialogWidth.XXXXL}>
            <div className="max-h-[85dvh] space-y-4 overflow-y-auto p-4 sm:p-6">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <Dialog.Title className="text-20 font-semibold">Description history</Dialog.Title>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Close history
                </Button>
              </header>
              <HistoryVersions scope={scope} capabilities={capabilities} onRestored={() => setOpen(false)} />
            </div>
          </Dialog.Panel>
        </Dialog>
      )}
    </>
  );
}
function HistoryVersions({
  scope,
  capabilities,
  onRestored,
}: {
  scope: Scope;
  capabilities: Capabilities;
  onRestored: () => void;
}) {
  const versions = usePaginatedQuery(api.tasks.history.list, { scope }, { initialNumItems: 30 });
  const [selected, setSelected] = useState<Id<"taskDescriptionVersions"> | null>(null);
  return (
    <div className="grid gap-5 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <nav aria-label="Saved description versions" className="space-y-2">
        <ul className="space-y-1">
          {versions.results.map((version) => (
            <li key={version._id}>
              <button
                aria-current={selected === version._id ? "true" : undefined}
                className={`w-full rounded-md p-2 text-left text-14 ${selected === version._id ? "bg-layer-3" : "hover:bg-layer-2"}`}
                onClick={() => setSelected(version._id)}
              >
                {new Date(version.lastSavedAt).toLocaleString()}
                <span className="block text-12 text-secondary">Revision {version.revision}</span>
              </button>
            </li>
          ))}
        </ul>
        {versions.status === "LoadingFirstPage" && <p role="status">Loading history…</p>}
        {versions.status === "Exhausted" && versions.results.length === 0 && (
          <p className="text-14 text-secondary">No saved versions yet.</p>
        )}
        {versions.status === "CanLoadMore" && (
          <Button variant="secondary" onClick={() => versions.loadMore(30)}>
            Load more versions
          </Button>
        )}
      </nav>
      {selected ? (
        <VersionPreview
          key={selected}
          scope={scope}
          versionId={selected}
          capabilities={capabilities}
          onRestored={onRestored}
        />
      ) : (
        <p className="text-14 text-secondary">Choose a saved version to preview.</p>
      )}
    </div>
  );
}
function VersionPreview({
  scope,
  versionId,
  capabilities,
  onRestored,
}: {
  scope: Scope;
  versionId: Id<"taskDescriptionVersions">;
  capabilities: Capabilities;
  onRestored: () => void;
}) {
  const version = useQuery(api.tasks.history.get, { scope, versionId });
  const restore = useMutation(api.tasks.history.restore);
  const [confirmation, setConfirmation] = useState<{
    args: FunctionArgs<typeof api.tasks.history.restore>;
    html: string;
    lastSavedAt: number;
  } | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  if (!version) return <p role="status">Loading saved description…</p>;
  return (
    <section className="min-w-0 space-y-3">
      <h3 className="text-16 font-medium">
        Saved {new Date(confirmation?.lastSavedAt ?? version.lastSavedAt).toLocaleString()}
      </h3>
      <TaskDescriptionEditor
        target={{ taskId: scope.taskId }}
        key={confirmation ? "confirmation" : version.revision}
        id={`history-${versionId}`}
        label="Saved description preview"
        placeholder="Empty description"
        html={confirmation?.html ?? version.html}
        editable={false}
      />
      {capabilities.canRestore &&
        (confirmation ? (
          <div className="space-y-3">
            <p className="text-14">
              Replace the current description with this preview? Other task properties stay unchanged.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                loading={pending}
                onClick={async () => {
                  setPending(true);
                  setError("");
                  try {
                    await restore(confirmation.args);
                    onRestored();
                  } catch (failure) {
                    setError(mutationMessage(failure));
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Confirm restore description
              </Button>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  setConfirmation(null);
                  setError("");
                }}
              >
                Cancel restore
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() =>
              setConfirmation({
                args: {
                  scope,
                  versionId,
                  expectedVersionRevision: version.revision,
                  expectedTaskUpdatedAt: capabilities.taskUpdatedAt,
                  ...(capabilities.intakeUpdatedAt === null
                    ? {}
                    : { expectedIntakeUpdatedAt: capabilities.intakeUpdatedAt }),
                },
                html: version.html,
                lastSavedAt: version.lastSavedAt,
              })
            }
          >
            Restore this description
          </Button>
        ))}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
