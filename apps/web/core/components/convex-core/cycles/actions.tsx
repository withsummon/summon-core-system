import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { Menu } from "@plane/propel/menu";
import { mutationMessage } from "../commercial/forms";
import { useCycleClock } from "./use-cycle-clock";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";

type Cycle = NonNullable<FunctionReturnType<typeof api.cycles.index.address>>;
type Operation = FunctionArgs<typeof api.cycles.index.lifecycle>["operation"];
const operations = {
  archive: {
    title: "Archive cycle",
    capability: "canArchive",
    description: "This cycle will move to project archives. Its work items remain in the project.",
  },
  unarchive: {
    title: "Restore archived cycle",
    capability: "canUnarchive",
    description: "This cycle will return to the cycles list. Its completed dates stay unchanged.",
  },
  delete: {
    title: "Delete cycle",
    capability: "canDelete",
    description: "This cycle will move to Trash. Its work items remain in the project.",
  },
  restore: {
    title: "Restore cycle",
    capability: "canRestore",
    description: "Restore this cycle and its remaining work items. Its dates must still fit the project schedule.",
  },
} as const satisfies Record<
  Operation,
  { title: string; capability: keyof FunctionReturnType<typeof api.cycles.index.get>; description: string }
>;
const operationChoices = ["archive", "unarchive", "delete", "restore"] as const satisfies Operation[];

export function CycleActions({
  cycle,
  href,
  onEdit,
  onTransfer,
}: {
  cycle: Cycle;
  href: string;
  onEdit: () => void;
  onTransfer: () => void;
}) {
  const [confirmation, setConfirmation] = useState<Operation | null>(null);
  const [copyError, setCopyError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [now] = useCycleClock();
  const live = useQuery(api.cycles.index.get, menuOpen ? { cycleId: cycle._id, now } : "skip");
  return (
    <>
      <Menu ellipsis ariaLabel={`Actions for ${cycle.name}`} handleOpenChange={setMenuOpen}>
        {live?.canEdit && <Menu.MenuItem onClick={onEdit}>Edit cycle</Menu.MenuItem>}
        {live?.canTransfer && <Menu.MenuItem onClick={onTransfer}>Transfer work items</Menu.MenuItem>}
        <Menu.MenuItem
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(new URL(href, window.location.origin).href);
              setCopyError("");
            } catch (failure) {
              setCopyError(mutationMessage(failure));
            }
          }}
        >
          Copy link
        </Menu.MenuItem>
        <Menu.MenuItem onClick={() => window.open(href, "_blank", "noopener,noreferrer")}>
          Open in new tab
        </Menu.MenuItem>
        {operationChoices.map(
          (operation) =>
            live?.[operations[operation].capability] &&
            (operation !== "delete" || !live.deleted) && (
              <Menu.MenuItem key={operation} onClick={() => setConfirmation(operation)}>
                {operations[operation].title}
              </Menu.MenuItem>
            )
        )}
      </Menu>
      {copyError && (
        <p role="alert" className="text-12 text-danger-primary">
          {copyError}
        </p>
      )}
      {confirmation && (
        <CycleLifecycle
          key={confirmation}
          cycle={cycle}
          operation={confirmation}
          onClose={() => setConfirmation(null)}
        />
      )}
    </>
  );
}

function CycleLifecycle({ cycle, operation, onClose }: { cycle: Cycle; operation: Operation; onClose: () => void }) {
  const [initial] = useState(cycle);
  const [clock] = useCycleClock();
  const live = useQuery(api.cycles.index.get, { cycleId: initial._id, now: clock });
  const lifecycle = useMutation(api.cycles.index.lifecycle);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const choice = operations[operation];
  const enabled = live?.[choice.capability] && (operation !== "delete" || !live.deleted);
  const release = useReloadConfirmations(pending, "The cycle action is still being saved.", onClose, pending);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <Dialog.Panel width={EDialogWidth.MD}>
        <div className="space-y-4 p-5">
          <Dialog.Title>{choice.title}?</Dialog.Title>
          <Dialog.Description className="text-13 text-secondary">{choice.description}</Dialog.Description>
          <p className="text-14 font-medium break-words">{initial.name}</p>
          {!enabled && (
            <p role="status" className="text-13 text-secondary">
              This action is unavailable. Cancel to return to the cycle.
            </p>
          )}
          {error && (
            <p role="alert" className="text-13 text-danger-primary">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={pending}
              disabled={!enabled}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await lifecycle({ cycleId: initial._id, expectedUpdatedAt: initial.updatedAt, operation });
                  release(onClose);
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              {choice.title}
            </Button>
          </div>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
