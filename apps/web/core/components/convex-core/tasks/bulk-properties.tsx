import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id, Doc } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { TaskProperties, type TaskPropertyValues } from "./task-properties";
import { bulkPropertyPatch, type BulkPropertyKey } from "./bulk-property-patch";
import { mutationMessage } from "../commercial/forms";
const fields: { key: BulkPropertyKey; label: string }[] = [
  { key: "state", label: "State" },
  { key: "priority", label: "Priority" },
  { key: "assignees", label: "Add assignees" },
  { key: "labels", label: "Add labels" },
  { key: "startDate", label: "Start date" },
  { key: "targetDate", label: "Target date" },
  { key: "estimate", label: "Estimate" },
];
export function BulkProperties({
  projectId,
  tasks,
  onClose,
  onSaved,
}: {
  projectId: Id<"projects">;
  tasks: Pick<Doc<"tasks">, "_id" | "updatedAt" | "title" | "sequence">[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [snapshot] = useState(tasks);
  const [enabled, setEnabled] = useState<BulkPropertyKey[]>([]);
  const [draft, setDraft] = useState<TaskPropertyValues>({
    status: "todo",
    stateId: null,
    priority: "none",
    assigneeIds: [],
    labelIds: [],
    startDate: null,
    targetDate: null,
    estimatePointId: null,
  });
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const update = useMutation(api.tasks.bulk_properties.update);
  return (
    <form
      className="space-y-4 border-t border-subtle-1 pt-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          await update({
            projectId,
            updates: snapshot.map((task) => ({
              taskId: task._id,
              expectedUpdatedAt: task.updatedAt,
              patch: bulkPropertyPatch(draft, enabled),
            })),
          });
          onSaved();
        } catch (cause) {
          setError(mutationMessage(cause));
        } finally {
          setPending(false);
        }
      }}
    >
      <h3 className="text-16 font-medium">Edit {snapshot.length} selected tasks</h3>
      <ul className="max-h-40 overflow-y-auto text-14">
        {snapshot.map((task) => (
          <li key={task._id}>
            #{task.sequence} · {task.title}
          </li>
        ))}
      </ul>
      <fieldset disabled={pending} className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {fields.map((field) => (
            <label key={field.key} className="flex items-center gap-2 text-14">
              <input
                type="checkbox"
                checked={enabled.includes(field.key)}
                onChange={(event) =>
                  setEnabled((current) =>
                    event.target.checked ? [...current, field.key] : current.filter((key) => key !== field.key)
                  )
                }
              />
              {field.label}
            </label>
          ))}
        </div>
        <p className="text-12 text-secondary">
          Only checked properties change. Assignees and labels are added to existing selections. Checked empty dates and
          No estimate clear those values. Choosing a status group replaces any custom state. All tasks update together.
        </p>
        <TaskProperties projectId={projectId} draft={draft} onChange={setDraft} />
        <div className="flex gap-2">
          <Button type="submit" loading={pending} disabled={!enabled.length}>
            Apply checked properties
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel property changes
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
