import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
export function CycleForm({
  projectId,
  cycle,
  onDone,
  onCancel,
}: {
  projectId: Id<"projects">;
  cycle: Doc<"cycles"> | null;
  onDone: (id: Id<"cycles">) => void;
  onCancel: () => void;
}) {
  const create = useMutation(api.cycles.index.create);
  const update = useMutation(api.cycles.index.update);
  const [initial] = useState(cycle);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="max-w-2xl space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        try {
          const fields = { name, description, startDate: startDate || null, endDate: endDate || null };
          if (initial) {
            await update({ cycleId: initial._id, expectedUpdatedAt: initial.updatedAt, ...fields });
            onDone(initial._id);
          } else onDone(await create({ projectId, ...fields }));
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-20 font-semibold">{initial ? "Edit cycle" : "New cycle"}</h2>
      <SummonField label="Cycle name">
        <Input required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
      </SummonField>
      <SummonField label="Description" htmlFor="cycle-description">
        <textarea
          id="cycle-description"
          rows={3}
          maxLength={10000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-subtle-1 bg-layer-2 p-3 text-14"
        />
      </SummonField>
      <div className="grid gap-3 sm:grid-cols-2">
        <SummonField label="Start date">
          <Input
            type="date"
            required={Boolean(endDate)}
            max={endDate || undefined}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </SummonField>
        <SummonField label="End date">
          <Input
            type="date"
            required={Boolean(startDate)}
            min={startDate || undefined}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </SummonField>
      </div>
      <p className="text-12 text-secondary">Set both dates, or leave both empty for a draft cycle.</p>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Save cycle
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
export function ProjectTimezone({ projectId }: { projectId: Id<"projects"> }) {
  const settings = useQuery(api.projects.timezone.get, { projectId });
  const [editing, setEditing] = useState(false);
  if (!settings) return <p role="status">Loading project timezone…</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-12 text-secondary">
          New cycles use {settings.timezone}. Existing cycles retain their timezone.
        </p>
        {settings.canManage && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit project timezone
          </Button>
        )}
      </div>
      {editing && settings.canManage && (
        <TimezoneForm projectId={projectId} initial={settings.timezone} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
function TimezoneForm({
  projectId,
  initial,
  onClose,
}: {
  projectId: Id<"projects">;
  initial: string;
  onClose: () => void;
}) {
  const save = useMutation(api.projects.timezone.save);
  const [expectedTimezone] = useState(initial);
  const [timezone, setTimezone] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="max-w-md space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        try {
          await save({ projectId, timezone, expectedTimezone });
          onClose();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <SummonField label="Project timezone">
        <Input required value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Jakarta" />
      </SummonField>
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Save timezone
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
  );
}
