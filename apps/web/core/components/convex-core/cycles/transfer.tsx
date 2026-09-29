import { Distribution } from "../tasks/progress/distribution";
import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { usePaginatedQuery as useCyclePages } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { cyclePhase } from "@summon/convex/cycle-calendar";
import { Button } from "@plane/propel/button";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { Select } from "@plane/propel/select";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
import { useCycleClock } from "./use-cycle-clock";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
type Cycle = NonNullable<FunctionReturnType<typeof api.cycles.index.address>>;
export function CycleTransfers({
  cycle,
  open = false,
  onOpenChange,
}: {
  cycle: Cycle;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [clock] = useCycleClock();
  const capabilities = useQuery(api.cycles.index.get, { cycleId: cycle._id, now: clock });
  const canTransfer = capabilities?.canTransfer === true;
  const jobs = usePaginatedQuery(
    api.cycles.transfer.list,
    cycle.canWrite && !cycle.deleted ? { cycleId: cycle._id } : "skip",
    { initialNumItems: 10 }
  );
  const [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<Id<"cycleTransfers"> | null>(null);
  const closePreparation = () => {
    setCreating(false);
    onOpenChange?.(false);
  };
  return (
    <section
      className="space-y-3 border-t border-subtle-1 pt-4"
      hidden={(!cycle.canWrite || cycle.deleted) && !selected && !creating && !open}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-16 font-medium">Unfinished task transfers</h3>
        {canTransfer && (
          <Button variant="secondary" onClick={() => setCreating(true)}>
            Transfer unfinished tasks
          </Button>
        )}
      </header>
      {(creating || open) && (
        <PrepareTransfer
          cycle={cycle}
          canTransfer={canTransfer}
          onCancel={closePreparation}
          onCreated={(id) => {
            closePreparation();
            setSelected(id);
          }}
        />
      )}
      <ul className="space-y-2">
        {jobs.results.map((job) => (
          <li key={job._id}>
            <Button variant="secondary" onClick={() => setSelected(job._id)}>
              {new Date(job._creationTime).toLocaleString()} · {job.status} ·{" "}
              {job.entries.filter((row) => row.outcome === "moved").length} moved
            </Button>
          </li>
        ))}
      </ul>
      {jobs.status === "LoadingFirstPage" && <p role="status">Loading transfers…</p>}
      {jobs.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => jobs.loadMore(10)}>
          Load more transfers
        </Button>
      )}
      {selected && (
        <TransferRun
          key={selected}
          transferId={selected}
          enabled={cycle.canWrite && !cycle.deleted}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
function PrepareTransfer({
  cycle,
  canTransfer,
  onCreated,
  onCancel,
}: {
  cycle: Cycle;
  canTransfer: boolean;
  onCreated: (id: Id<"cycleTransfers">) => void;
  onCancel: () => void;
}) {
  const [source] = useState(cycle),
    [destination, setDestination] = useState<Doc<"cycles"> | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [now] = useCycleClock();
  const [queryClock] = useState(Date.now);
  const choices = useCyclePages(
    api.cycles.index.browse,
    {
      projectId: cycle.projectId,
      view: "all",
      now: queryClock,
      phases: ["draft", "current", "upcoming"],
      search: "",
      startDate: null,
      endDate: null,
    },
    { initialNumItems: 30 }
  );
  const destinationCapabilities = useQuery(
    api.cycles.index.get,
    destination ? { cycleId: destination._id, now } : "skip"
  );
  const begin = useMutation(api.cycles.transfer.begin);
  const eligible = choices.results.filter(
    (row) => row._id !== source._id && !row.archived && cyclePhase(row, now) !== "completed"
  );
  const enabled =
    canTransfer &&
    destinationCapabilities?.canEdit === true &&
    destination !== null &&
    eligible.some((row) => row._id === destination._id);
  const release = useReloadConfirmations(pending, "The cycle transfer is still being prepared.", onCancel);
  return (
    <Dialog
      open
      onOpenChange={(visible) => {
        if (!visible && !pending) onCancel();
      }}
    >
      <Dialog.Panel width={EDialogWidth.XXL}>
        <div className="p-5">
          <Dialog.Title className="mb-4">Transfer unfinished work items</Dialog.Title>
          <div className="space-y-3 rounded-md border border-subtle-1 p-3">
            <p className="text-14">
              Save a snapshot, then move unfinished tasks in batches. Completed and cancelled tasks stay in this cycle.
              Changes made after the snapshot need review before continuing.
            </p>
            <SummonField label="Destination cycle" htmlFor="cycle-transfer-destination">
              <Select
                id="cycle-transfer-destination"
                value={destination?._id ?? ""}
                disabled={pending}
                placeholder="Select open cycle"
                options={eligible.map((row) => ({ value: row._id, label: `${row.name} · ${cyclePhase(row, now)}` }))}
                onValueChange={(value) => setDestination(eligible.find((row) => row._id === value) ?? null)}
              />
            </SummonField>
            {choices.status === "CanLoadMore" && (
              <Button variant="secondary" onClick={() => choices.loadMore(30)}>
                Load more cycles
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                disabled={!enabled}
                loading={pending}
                onClick={async () => {
                  if (!enabled || !destination) return;
                  setPending(true);
                  setError("");
                  try {
                    const transferId = await begin({
                      sourceId: source._id,
                      destinationId: destination._id,
                      expectedSourceUpdatedAt: source.updatedAt,
                      expectedDestinationUpdatedAt: destination.updatedAt,
                    });
                    release(() => onCreated(transferId));
                  } catch (failure) {
                    setError(mutationMessage(failure));
                  } finally {
                    setPending(false);
                  }
                }}
              >
                Create transfer snapshot
              </Button>
              <Button variant="secondary" disabled={pending} onClick={onCancel}>
                Cancel
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-14 text-danger-primary">
                {error}
              </p>
            )}
          </div>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
function TransferRun({
  transferId,
  enabled,
  onClose,
}: {
  transferId: Id<"cycleTransfers">;
  enabled: boolean;
  onClose: () => void;
}) {
  const result = useQuery(api.cycles.transfer.inspect, enabled ? { transferId } : "skip");
  const [clock] = useCycleClock();
  const destination = useQuery(
    api.cycles.index.get,
    result ? { cycleId: result.job.destinationId, now: clock } : "skip"
  );
  const step = useMutation(api.cycles.transfer.step),
    skip = useMutation(api.cycles.transfer.skipChanged),
    cancel = useMutation(api.cycles.transfer.cancel);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<{
    kind: "skip" | "cancel";
    revision: number;
    taskIds: Id<"tasks">[];
  } | null>(null);
  useReloadConfirmations(pending, "The cycle transfer is still in progress.", onClose);
  if (!enabled)
    return (
      <div className="space-y-2">
        <p role="status">Transfer access changed. Your saved snapshot is retained.</p>
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          Close transfer
        </Button>
      </div>
    );
  if (!result) return <p role="status">Opening transfer…</p>;
  const { job, blockers } = result;
  const moved = job.entries.filter((row) => row.outcome === "moved").length,
    skipped = job.entries.filter((row) => row.outcome === "skipped").length,
    remaining = job.entries.filter((row) => row.outcome === "pending").length;
  async function run(action: () => Promise<unknown>) {
    setPending(true);
    setError("");
    try {
      await action();
      setConfirmation(null);
    } catch (failure) {
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(visible) => {
        if (!visible && !pending) onClose();
      }}
    >
      <Dialog.Panel width={EDialogWidth.XXL}>
        <div className="space-y-4 rounded-md border border-subtle-1 p-4">
          <header className="flex flex-wrap justify-between gap-2">
            <Dialog.Title className="text-16 font-medium">Transfer · {job.status}</Dialog.Title>
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              Close transfer
            </Button>
          </header>
          <p className="text-14">
            Destination: {destination?.name ?? "Loading…"}
            {destination?.archived ? " · Archived" : ""}
            {destination?.deleted ? " · Removed" : ""}
          </p>
          <p className="text-14">
            {moved} moved · {skipped} skipped · {remaining} pending
          </p>
          {job.status === "cancelled" && (
            <p className="text-14">Remaining work was cancelled. Tasks already moved stay in the destination cycle.</p>
          )}
          <Snapshot snapshot={job.snapshot} />
          {job.status === "running" && (
            <>
              <ul className="space-y-1 text-14">
                {blockers.map((blocker) => (
                  <li key={blocker.taskId}>
                    {blocker.title}: {blocker.reason}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={blockers.length > 0 || !destination?.canEdit}
                  loading={pending}
                  onClick={() => run(() => step({ transferId, expectedRevision: job.revision }))}
                >
                  Move next batch
                </Button>
                {blockers.length > 0 && (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      setConfirmation({
                        kind: "skip",
                        revision: job.revision,
                        taskIds: blockers.map((row) => row.taskId),
                      })
                    }
                  >
                    Review skipping changed tasks
                  </Button>
                )}
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setConfirmation({ kind: "cancel", revision: job.revision, taskIds: [] })}
                >
                  Cancel remaining transfer
                </Button>
              </div>
            </>
          )}
          {confirmation && (
            <div className="space-y-2 border-t border-subtle-1 pt-3">
              <p className="text-14">
                {confirmation.kind === "skip"
                  ? `Skip these ${confirmation.taskIds.length} changed tasks? They will not be moved by this transfer.`
                  : "Cancel all remaining work? Tasks already moved will not be returned to the source."}
              </p>
              <div className="flex gap-2">
                <Button
                  loading={pending}
                  onClick={() =>
                    run(() =>
                      confirmation.kind === "skip"
                        ? skip({ transferId, expectedRevision: confirmation.revision, taskIds: confirmation.taskIds })
                        : cancel({ transferId, expectedRevision: confirmation.revision })
                    )
                  }
                >
                  Confirm {confirmation.kind === "skip" ? "skip" : "cancellation"}
                </Button>
                <Button variant="secondary" disabled={pending} onClick={() => setConfirmation(null)}>
                  Keep reviewing
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
      </Dialog.Panel>
    </Dialog>
  );
}
function Snapshot({ snapshot }: { snapshot: Doc<"cycleTransfers">["snapshot"] }) {
  return (
    <details className="space-y-3">
      <summary className="cursor-pointer text-14 font-medium">
        Snapshot before transfer · {snapshot.count} tasks
      </summary>
      <p className="text-14">
        Numeric estimates: {snapshot.numericEstimates} · Estimates without a numeric value:{" "}
        {snapshot.unquantifiedEstimates}
      </p>
      <Distribution heading="h5" kind="statuses" rows={snapshot.statuses} />
      <Distribution heading="h5" kind="assignees" rows={snapshot.assignees} />
      <Distribution heading="h5" kind="labels" rows={snapshot.labels} />
      <p className="text-12 text-secondary">
        A task appears under each assigned person and label, so distribution totals may overlap.
      </p>
    </details>
  );
}
