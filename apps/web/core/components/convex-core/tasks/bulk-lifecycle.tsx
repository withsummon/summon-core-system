import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import type { FunctionArgs } from "convex/server";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
type Capture = Pick<Doc<"tasks">, "_id" | "updatedAt" | "title" | "sequence">;
type Operation = FunctionArgs<typeof api.tasks.lifecycle.bulk>["operation"];
const operationLabels: Record<Operation, string> = {
  archive: "Archive",
  unarchive: "Unarchive",
  restore: "Restore",
  delete: "Move to Trash",
};
export function BulkLifecycle({
  projectId,
  rows,
  view,
}: {
  projectId: Id<"projects">;
  rows: Capture[];
  view: "active" | "archived" | "deleted";
}) {
  const access = useQuery(api.tasks.lifecycle.bulkAccess, { projectId });
  const bulk = useMutation(api.tasks.lifecycle.bulk);
  const [selected, setSelected] = useState<Capture[]>([]);
  const [confirmation, setConfirmation] = useState<Operation | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!access?.canChange) return null;
  const operations: Operation[] = view === "deleted" ? ["restore"] : view === "archived" ? ["unarchive"] : ["archive"];
  if (view !== "deleted" && access.canDelete) operations.push("delete");
  return (
    <details className="rounded-lg border border-subtle-1 p-3">
      <summary className="cursor-pointer text-14">Select tasks for bulk actions</summary>
      <div className="mt-3 space-y-3">
        <p className="text-12 text-secondary">
          Select up to {access.maxTasks} loaded tasks. If a task changes, select it again.
        </p>
        <fieldset disabled={pending || confirmation !== null} className="max-h-64 space-y-2 overflow-y-auto">
          {rows.map((row) => (
            <label key={row._id} className="flex items-center gap-2 text-14">
              <input
                type="checkbox"
                checked={selected.some((item) => item._id === row._id)}
                disabled={selected.length >= access.maxTasks && !selected.some((item) => item._id === row._id)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked ? [...current, row] : current.filter((item) => item._id !== row._id)
                  )
                }
              />
              #{row.sequence} · {row.title}
            </label>
          ))}
        </fieldset>
        <p className="text-12">{selected.length} selected</p>
        {confirmation ? (
          <div className="space-y-2">
            <p className="text-14">
              {operationLabels[confirmation]} for {selected.length} tasks? All changes succeed together. Comments and
              links are retained; restored archived tasks stay archived.
            </p>
            <ul className="max-h-48 overflow-y-auto text-14">
              {selected.map((row) => (
                <li key={row._id}>
                  #{row.sequence} · {row.title}
                </li>
              ))}
            </ul>
            <Button
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await bulk({
                    projectId,
                    operation: confirmation,
                    tasks: selected.map((row) => ({ taskId: row._id, expectedUpdatedAt: row.updatedAt })),
                  });
                  setSelected([]);
                  setConfirmation(null);
                } catch (cause) {
                  setError(mutationMessage(cause));
                } finally {
                  setPending(false);
                }
              }}
            >
              Confirm {operationLabels[confirmation]}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setConfirmation(null)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {operations.map((operation) => (
              <Button
                key={operation}
                variant="secondary"
                disabled={!selected.length}
                onClick={() => {
                  setError("");
                  setConfirmation(operation);
                }}
              >
                {operationLabels[operation]} selected
              </Button>
            ))}
          </div>
        )}
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setSelected([]);
            setConfirmation(null);
            setError("");
          }}
        >
          Clear selection
        </Button>
        {error && (
          <p role="alert" className="text-14 text-danger-primary">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
