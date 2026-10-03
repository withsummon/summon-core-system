import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage, selectClass } from "../commercial/forms";
type System = FunctionReturnType<typeof api.estimates.index.get>;
export function SystemForm({
  projectId,
  initial,
  onClose,
}: {
  projectId: Id<"projects">;
  initial?: System;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<
    Pick<FunctionArgs<typeof api.estimates.index.create>, "name" | "description" | "type">
  >({ name: initial?.name ?? "", description: initial?.description ?? "", type: initial?.type ?? "points" });
  const [snapshot] = useState(initial);
  const [firstValue, setFirstValue] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const create = useMutation(api.estimates.index.create),
    update = useMutation(api.estimates.index.update);
  return (
    <form
      className="space-y-3 rounded-md border border-subtle-1 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          if (snapshot) await update({ systemId: snapshot._id, expectedRevision: snapshot.revision, ...draft });
          else await create({ projectId, ...draft, points: [{ key: 0, value: firstValue, description: "" }] });
          onClose();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="space-y-3">
        <SummonField label="Estimate system name">
          <Input
            required
            maxLength={255}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </SummonField>
        <SummonField label="System type" htmlFor="estimate-type">
          <select
            id="estimate-type"
            className={selectClass}
            value={draft.type}
            onChange={(e) => {
              if (e.target.value === "points" || e.target.value === "categories")
                setDraft({ ...draft, type: e.target.value });
            }}
          >
            <option value="points">Points</option>
            <option value="categories">Categories</option>
          </select>
        </SummonField>
        <SummonField label="System description">
          <Input
            maxLength={20000}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </SummonField>
        {!snapshot && (
          <SummonField label="First point value">
            <Input required maxLength={20} value={firstValue} onChange={(e) => setFirstValue(e.target.value)} />
          </SummonField>
        )}
        <div className="flex gap-2">
          <Button type="submit" loading={pending}>
            Save system
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
export function PointForm({
  system,
  initial,
  onClose,
}: {
  system: System;
  initial?: System["points"][number];
  onClose: () => void;
}) {
  const [snapshot] = useState({ system, initial });
  const [draft, setDraft] = useState({
    key: initial?.key ?? system.points.length,
    value: initial?.value ?? "",
    description: initial?.description ?? "",
  });
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const create = useMutation(api.estimates.index.createPoint),
    update = useMutation(api.estimates.index.updatePoint);
  return (
    <form
      className="space-y-3 rounded-md border border-subtle-1 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          if (snapshot.initial)
            await update({ pointId: snapshot.initial._id, expectedRevision: snapshot.initial.revision, ...draft });
          else
            await create({ systemId: snapshot.system._id, expectedSystemRevision: snapshot.system.revision, ...draft });
          onClose();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="space-y-3">
        <SummonField label="Point value">
          <Input
            required
            maxLength={20}
            value={draft.value}
            onChange={(e) => setDraft({ ...draft, value: e.target.value })}
          />
        </SummonField>
        <SummonField label="Point order">
          <Input
            type="number"
            min={0}
            step={1}
            required
            value={draft.key}
            onChange={(e) => setDraft({ ...draft, key: e.target.valueAsNumber })}
          />
        </SummonField>
        <SummonField label="Point description">
          <Input
            maxLength={20000}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </SummonField>
        <div className="flex gap-2">
          <Button type="submit" loading={pending}>
            Save point
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
