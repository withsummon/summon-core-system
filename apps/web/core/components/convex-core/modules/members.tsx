import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { memberLabel } from "@summon/convex/member-label";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { ModalCore } from "@plane/ui";
import { mutationMessage } from "../commercial/forms";
import { ModulePersonPicker } from "./controls";
type Module = FunctionReturnType<typeof api.modules.index.get>;

export function ModuleMembers({ module, onBusy }: { module: Module; onBusy?: (busy: boolean) => void }) {
  const people = usePaginatedQuery(api.modules.members.list, module.deleted ? "skip" : { moduleId: module._id }, {
    initialNumItems: 30,
  });
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Id<"users"> | null>(null);
  return (
    <section aria-label="Module members" className="space-y-3" hidden={module.deleted && !adding && !removing}>
      {!module.deleted && (
        <>
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-14 font-medium">Members</h3>
            {module.canEdit && (
              <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
                Add member
              </Button>
            )}
          </header>
          <ul className="space-y-2">
            {people.results.map((person) => (
              <li key={person.userId} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-13">{memberLabel({ ...person, id: person.userId })}</span>
                {module.canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(person.userId)}>
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {people.status === "LoadingFirstPage" && (
            <p role="status" className="text-13 text-secondary">
              Loading members…
            </p>
          )}
          {people.status === "Exhausted" && !people.results.length && (
            <p className="text-13 text-secondary">No members.</p>
          )}
          {people.status === "CanLoadMore" && (
            <Button size="sm" variant="ghost" onClick={() => people.loadMore(30)}>
              Load more members
            </Button>
          )}
        </>
      )}
      {adding && <MemberDialog module={module} assigned onBusy={onBusy} onClose={() => setAdding(false)} />}
      {removing && (
        <MemberDialog
          key={removing}
          module={module}
          userId={removing}
          assigned={false}
          onBusy={onBusy}
          onClose={() => setRemoving(null)}
        />
      )}
    </section>
  );
}

function MemberDialog({
  module,
  userId: initialUser = null,
  assigned,
  onClose,
  onBusy,
}: {
  module: Module;
  userId?: Id<"users"> | null;
  assigned: boolean;
  onClose: () => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [expectedUpdatedAt] = useState(module.updatedAt);
  const [userId, setUserId] = useState(initialUser);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const save = useMutation(api.modules.members.set);
  useReloadConfirmations(pending, "The module member is still being saved.", onClose, pending);
  return (
    <ModalCore
      isOpen
      handleClose={() => {
        if (!pending) onClose();
      }}
    >
      <form
        className="space-y-4 p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!userId || !module.canEdit || pending) return;
          setPending(true);
          onBusy?.(true);
          setError("");
          try {
            await save({ moduleId: module._id, userId, assigned, expectedUpdatedAt });
            onClose();
          } catch (failure) {
            setError(mutationMessage(failure));
          } finally {
            setPending(false);
            onBusy?.(false);
          }
        }}
      >
        <Dialog.Title className="text-18 font-medium">{assigned ? "Add member" : "Remove member"}</Dialog.Title>
        {assigned ? (
          <ModulePersonPicker
            projectId={module.projectId}
            value={userId}
            onChange={setUserId}
            disabled={pending || !module.canEdit}
            label="Module member"
          />
        ) : (
          <Dialog.Description className="text-14 text-secondary">
            Remove this person from the module? Their project membership stays the same.
          </Dialog.Description>
        )}
        {!module.canEdit && (
          <p className="text-14 text-secondary">This module is read-only. Your selection is retained.</p>
        )}
        {error && (
          <p role="alert" className="text-14 text-danger-primary">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} disabled={!userId || !module.canEdit}>
            {assigned ? "Add member" : "Remove member"}
          </Button>
        </div>
      </form>
    </ModalCore>
  );
}
