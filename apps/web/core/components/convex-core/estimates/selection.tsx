import { useQuery } from "convex/react";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { SummonField } from "@/components/summon/forms";
import { selectClass } from "../commercial/forms";
export function EstimateSelection({
  projectId,
  value,
  onChange,
}: {
  projectId: Id<"projects"> | null;
  value: Id<"estimatePoints"> | null;
  onChange: (id: Id<"estimatePoints"> | null) => void;
}) {
  const choices = useQuery(api.estimates.selection.choices, projectId ? { projectId } : "skip");
  return (
    <SummonField label="Estimate" htmlFor="task-estimate">
      <select
        id="task-estimate"
        className={selectClass}
        value={value ?? ""}
        disabled={!choices?.canAssign}
        onChange={(event) => {
          if (!event.target.value) onChange(null);
          else {
            const point = choices?.points.find((item) => item._id === event.target.value);
            if (point) onChange(point._id);
          }
        }}
      >
        <option value="">No estimate</option>
        {value && !choices?.points.some((point) => point._id === value) && (
          <option value={value}>Previously selected estimate (inactive or unavailable)</option>
        )}
        {choices?.points.map((point) => (
          <option key={point._id} value={point._id}>
            {point.value}
          </option>
        ))}
      </select>
      {choices?.system && <p className="text-12 text-secondary">{choices.system.name}</p>}
    </SummonField>
  );
}
export function TaskEstimate({ taskId }: { taskId: Id<"tasks"> }) {
  const selection = useQuery(api.estimates.selection.forTask, { taskId });
  if (!selection) return null;
  return (
    <p className="text-14">
      Estimate: {selection.point.value}{" "}
      <span className="text-secondary">
        · {selection.system?.name}
        {selection.point.deleted || selection.system?.deleted ? " (removed)" : ""}
      </span>
    </p>
  );
}
export function DraftEstimate({ draftId }: { draftId: Id<"taskDrafts"> }) {
  const selection = useQuery(api.estimates.selection.forDraft, { draftId });
  if (!selection) return null;
  return (
    <p className="text-14">
      Saved estimate: {selection.point.value}{" "}
      <span className="text-secondary">
        · {selection.system?.name}
        {selection.point.deleted || selection.system?.deleted ? " (removed)" : ""}
      </span>
    </p>
  );
}
