import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
import { FolderPicker } from "./folder-picker";
type Favorite = FunctionReturnType<typeof api.favorites.index.list>["page"][number];
export function FavoriteEditor({
  row,
  locationName,
  onClose,
}: {
  row: Favorite;
  locationName: string;
  onClose: () => void;
}) {
  const [name, setName] = useState(row.name ?? ""),
    [parentId, setParentId] = useState(row.parentId),
    [sequence, setSequence] = useState(String(row.sequence)),
    [folderName, setFolderName] = useState(locationName),
    [choosing, setChoosing] = useState(false),
    [removing, setRemoving] = useState(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const reorder = useMutation(api.favorites.reorder.move);
  const update = useMutation(api.favorites.index.update),
    lifecycle = useMutation(api.favorites.index.lifecycle);
  const [notice, setNotice] = useState("");
  const hasEdits = name !== (row.name ?? "") || parentId !== row.parentId || sequence !== String(row.sequence);
  const label = row.name || row.entity.name || "Untitled folder";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <Dialog.Panel width={EDialogWidth.LG}>
        <div className="max-h-[85dvh] space-y-4 overflow-y-auto p-4 sm:p-6">
          <Dialog.Title className="text-20 font-semibold">
            {!row.isRemoved ? "Manage favorite" : "Restore favorite"}
          </Dialog.Title>
          <p className="text-14 break-words">{label}</p>
          {!row.isRemoved && !removing && (
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setPending(true);
                setError("");
                try {
                  await update({
                    favoriteId: row._id,
                    expectedUpdatedAt: row.updatedAt,
                    name: name || null,
                    parentId,
                    sequence: Number(sequence),
                  });
                  onClose();
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              <fieldset disabled={pending} className="space-y-4">
                <SummonField label={row.target.type === "folder" ? "Folder name" : "Favorite label (optional)"}>
                  <Input
                    value={name}
                    maxLength={255}
                    required={row.target.type === "folder"}
                    placeholder={row.entity.name ?? "Folder name"}
                    onChange={(event) => setName(event.target.value)}
                  />
                </SummonField>
                <div className="space-y-2">
                  <p className="text-14">Folder: {folderName}</p>
                  <Button variant="secondary" onClick={() => setChoosing(!choosing)}>
                    Choose folder
                  </Button>
                </div>
                {choosing && (
                  <FolderPicker
                    workspaceId={row.workspaceId}
                    excludeId={row.target.type === "folder" ? row._id : undefined}
                    onSelect={(folder) => {
                      setParentId(folder?.id ?? null);
                      setFolderName(folder?.name ?? "Favorites root");
                      setChoosing(false);
                    }}
                  />
                )}
                {parentId === row.parentId && (
                  <details>
                    <summary className="cursor-pointer text-14">Manual order</summary>
                    <SummonField label="Order (higher appears earlier)">
                      <Input
                        type="number"
                        step="any"
                        required
                        value={sequence}
                        onChange={(event) => setSequence(event.target.value)}
                      />
                    </SummonField>
                  </details>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" loading={pending}>
                    Save favorite
                  </Button>
                  <Button variant="secondary" onClick={() => setRemoving(true)}>
                    Remove favorite
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
          {!row.isRemoved && !removing && (
            <div className="flex flex-wrap gap-2">
              {(["up", "down"] as const).map((direction) => (
                <Button
                  key={direction}
                  variant="secondary"
                  disabled={pending || hasEdits}
                  onClick={async () => {
                    setPending(true);
                    setError("");
                    try {
                      const result = await reorder({
                        favoriteId: row._id,
                        expectedUpdatedAt: row.updatedAt,
                        direction,
                      });
                      if (result.moved) onClose();
                      else
                        setNotice(
                          direction === "up"
                            ? "Already at the beginning of this folder."
                            : "Already at the end of this folder."
                        );
                    } catch (failure) {
                      setError(mutationMessage(failure));
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  {direction === "up" ? "Move earlier" : "Move later"}
                </Button>
              ))}
            </div>
          )}
          {hasEdits && !removing && !row.isRemoved && (
            <p className="text-12 text-secondary">Save changes before reordering.</p>
          )}
          {(removing || row.isRemoved) && (
            <div className="space-y-3">
              <p className="text-14">
                {row.isRemoved
                  ? "Restore this favorite in its original folder?"
                  : row.target.type === "folder"
                    ? "Remove this folder? Its nested favorites will be hidden until the folder is restored."
                    : "Remove this favorite? The original item is unchanged."}
              </p>
              <Button
                loading={pending}
                onClick={async () => {
                  setPending(true);
                  setError("");
                  try {
                    await lifecycle({
                      favoriteId: row._id,
                      expectedUpdatedAt: row.updatedAt,
                      deleted: !row.isRemoved,
                    });
                    onClose();
                  } catch (failure) {
                    setError(mutationMessage(failure));
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {row.isRemoved ? "Confirm restore favorite" : "Confirm remove favorite"}
              </Button>
              {removing && (
                <Button variant="secondary" disabled={pending} onClick={() => setRemoving(false)}>
                  Keep favorite
                </Button>
              )}
            </div>
          )}
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Close
          </Button>
          {notice && (
            <p role="status" className="text-14 text-secondary">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="text-14 text-danger-primary">
              {error}
            </p>
          )}
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
export function CreateFolder({
  workspaceId,
  parentId,
  onClose,
}: {
  workspaceId: Id<"workspaces">;
  parentId: Id<"favorites"> | null;
  onClose: () => void;
}) {
  const create = useMutation(api.favorites.index.create);
  const [name, setName] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <Dialog.Panel width={EDialogWidth.LG}>
        <form
          className="space-y-4 p-4 sm:p-6"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            try {
              await create({ workspaceId, parentId, name, target: { type: "folder" } });
              onClose();
            } catch (failure) {
              setError(mutationMessage(failure));
            } finally {
              setPending(false);
            }
          }}
        >
          <Dialog.Title className="text-20 font-semibold">Create favorite folder</Dialog.Title>
          <SummonField label="Folder name">
            <Input value={name} required maxLength={255} onChange={(event) => setName(event.target.value)} />
          </SummonField>
          <div className="flex gap-2">
            <Button type="submit" loading={pending}>
              Create folder
            </Button>
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-14 text-danger-primary">
              {error}
            </p>
          )}
        </form>
      </Dialog.Panel>
    </Dialog>
  );
}
