import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { cyclePhase } from "@summon/convex/cycle-calendar";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage, selectClass } from "../commercial/forms";
import { useCycleClock } from "./use-cycle-clock";
type Cycle = FunctionReturnType<typeof api.cycles.index.get>;
export function CycleTransfers({ cycle }: { cycle: Cycle }) {
  const jobs = usePaginatedQuery(api.cycles.transfer.list, { cycleId: cycle._id }, { initialNumItems: 10 });
  const [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<Id<"cycleTransfers"> | null>(null);
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-16 font-medium">Unfinished task transfers</h3>
        {cycle.phase === "completed" && !cycle.archived && (
          <Button variant="secondary" onClick={() => setCreating(true)}>
            Transfer unfinished tasks
          </Button>
        )}
      </header>
      {creating && (
        <PrepareTransfer
          cycle={cycle}
          onCancel={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
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
      {selected && <TransferRun key={selected} transferId={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
function PrepareTransfer({
  cycle,
  onCreated,
  onCancel,
}: {
  cycle: Cycle;
  onCreated: (id: Id<"cycleTransfers">) => void;
  onCancel: () => void;
}) {
  const [source] = useState(cycle),
    [destination, setDestination] = useState<Doc<"cycles"> | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [now] = useCycleClock();
  const choices = usePaginatedQuery(
    api.cycles.index.list,
    { projectId: cycle.projectId, deleted: false },
    { initialNumItems: 30 }
  );
  const begin = useMutation(api.cycles.transfer.begin);
  const eligible = choices.results.filter(
    (row) => row._id !== source._id && !row.archived && cyclePhase(row, now) !== "completed"
  );
  return (
    <div className="space-y-3 rounded-md border border-subtle-1 p-3">
      <p className="text-14">
        Save a snapshot, then move unfinished tasks in batches. Completed and cancelled tasks stay in this cycle.
        Changes made after the snapshot need review before continuing.
      </p>
      <SummonField label="Destination cycle" htmlFor="cycle-transfer-destination">
        <select
          id="cycle-transfer-destination"
          className={selectClass}
          value={destination?._id ?? ""}
          disabled={pending}
          onChange={(event) => setDestination(eligible.find((row) => row._id === event.target.value) ?? null)}
        >
          <option value="">Select open cycle</option>
          {destination && !eligible.some((row) => row._id === destination._id) && (
            <option value={destination._id}>Selected cycle is unavailable</option>
          )}
          {eligible.map((row) => (
            <option key={row._id} value={row._id}>
              {row.name} · {cyclePhase(row, now)}
            </option>
          ))}
        </select>
      </SummonField>
      {choices.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => choices.loadMore(30)}>
          Load more cycles
        </Button>
      )}
      <div className="flex gap-2">
        <Button
          disabled={!destination}
          loading={pending}
          onClick={async () => {
            if (!destination) return;
            setPending(true);
            setError("");
            try {
              onCreated(
                await begin({
                  sourceId: source._id,
                  destinationId: destination._id,
                  expectedSourceUpdatedAt: source.updatedAt,
                  expectedDestinationUpdatedAt: destination.updatedAt,
                })
              );
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
  );
}
function TransferRun({ transferId, onClose }: { transferId: Id<"cycleTransfers">; onClose: () => void }) {
  const result = useQuery(api.cycles.transfer.inspect, { transferId });
  const [clock] = useState(Date.now);
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
    <div className="space-y-4 rounded-md border border-subtle-1 p-4">
      <header className="flex flex-wrap justify-between gap-2">
        <h4 className="text-16 font-medium">Transfer · {job.status}</h4>
        <Button variant="secondary" onClick={onClose}>
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
              disabled={blockers.length > 0 || !destination}
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
                  setConfirmation({ kind: "skip", revision: job.revision, taskIds: blockers.map((row) => row.taskId) })
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
      <Distribution title="Status" rows={snapshot.statuses} />
      <Distribution title="Assignees" rows={snapshot.assignees} />
      <Distribution title="Labels" rows={snapshot.labels} />
      <p className="text-12 text-secondary">
        A task appears under each assigned person and label, so distribution totals may overlap.
      </p>
    </details>
  );
}
function Distribution({ title, rows }: { title: string; rows: Doc<"cycleTransfers">["snapshot"]["labels"] }) {
  const [visible, setVisible] = useState(50);
  return (
    <div>
      <h5 className="text-14 font-medium">{title}</h5>
      <ul className="text-14">
        {rows.slice(0, visible).map((row) => (
          <li key={row.id ?? "none"}>
            {row.name}: {row.count} tasks · {row.numericEstimates} numeric estimates
            {row.unquantifiedEstimates > 0 ? ` · ${row.unquantifiedEstimates} nonnumeric estimates` : ""}
          </li>
        ))}
      </ul>
      {visible < rows.length && (
        <Button variant="secondary" onClick={() => setVisible((value) => value + 50)}>
          Show more {title.toLowerCase()}
        </Button>
      )}
    </div>
  );
}
