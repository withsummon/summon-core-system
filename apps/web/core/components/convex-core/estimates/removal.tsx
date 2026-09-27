import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage, selectClass } from "../commercial/forms";
type System = FunctionReturnType<typeof api.estimates.index.get>;
export function EstimateRemoval({
  system,
  point,
  onClose,
}: {
  system: System;
  point: System["points"][number] | null;
  onClose: () => void;
}) {
  const [snapshot] = useState({ system, point });
  const choices = useQuery(api.estimates.selection.choices, { projectId: system.projectId });
  const [replacementId, setReplacementId] = useState<Id<"estimatePoints"> | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const begin = useMutation(api.estimates.remap.begin);
  const available = choices?.points.filter((candidate) =>
    snapshot.point ? candidate._id !== snapshot.point._id : candidate.systemId !== snapshot.system._id
  );
  return (
    <section className="space-y-3 rounded-md border border-subtle-1 p-4">
      <h4 className="text-16 font-medium">Remove {snapshot.point?.value ?? snapshot.system.name}</h4>
      <p className="text-14">
        Task and private draft estimates will be replaced in batches before removal. Completed changes cannot be undone.
        You can leave and resume later.
      </p>
      <SummonField label="Replacement estimate" htmlFor="estimate-replacement">
        <select
          id="estimate-replacement"
          className={selectClass}
          disabled={pending}
          value={replacementId ?? ""}
          onChange={(event) => {
            if (!event.target.value) setReplacementId(null);
            else {
              const selected = available?.find((item) => item._id === event.target.value);
              if (selected) setReplacementId(selected._id);
            }
          }}
        >
          <option value="">Clear affected estimates</option>
          {replacementId && !available?.some((item) => item._id === replacementId) && (
            <option value={replacementId}>Selected replacement unavailable</option>
          )}
          {available?.map((item) => (
            <option key={item._id} value={item._id}>
              {item.value}
            </option>
          ))}
        </select>
      </SummonField>
      {!snapshot.point && (
        <p className="text-12 text-secondary">
          To move estimates to another system, select that system as active before starting removal.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!choices}
          loading={pending}
          onClick={async () => {
            setPending(true);
            setError("");
            try {
              await begin({
                systemId: snapshot.system._id,
                pointId: snapshot.point?._id ?? null,
                expectedSystemRevision: snapshot.system.revision,
                expectedPointRevision: snapshot.point?.revision ?? null,
                replacementId,
              });
              onClose();
            } catch (failure) {
              setError(mutationMessage(failure));
            } finally {
              setPending(false);
            }
          }}
        >
          Begin replacement and removal
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
    </section>
  );
}
export function EstimateProgress({
  jobId,
  canWrite,
  onComplete,
}: {
  jobId: Id<"estimateRemaps">;
  canWrite: boolean;
  onComplete: () => void;
}) {
  const job = useQuery(api.estimates.remap.get, { jobId });
  const page = useMutation(api.estimates.remap.page);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  if (!job) return <p role="status">Loading estimate replacement…</p>;
  return (
    <section className="space-y-3 rounded-md border border-subtle-1 p-4">
      <h4 className="text-16 font-medium">Estimate replacement</h4>
      <p role="status" className="text-14">
        {job.phase === "complete" ? "Replacement complete" : `Processing ${job.phase}`} · {job.changed} references
        changed.
      </p>
      {job.phase !== "complete" && (
        <>
          <p className="text-14 text-secondary">
            Continue one batch at a time. Leaving pauses progress; completed batches remain saved.
          </p>
          {canWrite && (
            <Button
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  const result = await page({ jobId, expectedRevision: job.revision });
                  if (result.phase === "complete") onComplete();
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Continue replacement
            </Button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
