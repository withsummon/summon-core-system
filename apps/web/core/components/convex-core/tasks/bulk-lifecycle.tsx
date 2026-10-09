import { BulkMemberships } from "./bulk-memberships";
import { BulkProperties } from "./bulk-properties";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
type Capture = FunctionReturnType<typeof api.tasks.lifecycle.list>["page"][number];
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
  const [captured, setCaptured] = useState<Capture[]>([]);
  const selectable = view === "deleted" ? rows.filter((row) => row.canRestore) : rows;
  const selected = captured.filter((capture) =>
    selectable.some((row) => row._id === capture._id && row.updatedAt === capture.updatedAt)
  );
  const [confirmation, setConfirmation] = useState<Operation | null>(null);
  const [membershipsEditing, setMembershipsEditing] = useState(false);
  const [propertiesEditing, setPropertiesEditing] = useState(false);
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
        <fieldset
          disabled={pending || confirmation !== null || propertiesEditing || membershipsEditing}
          className="max-h-64 space-y-2 overflow-y-auto"
        >
          {selectable.map((row) => (
            <label key={row._id} className="flex items-center gap-2 text-14">
              <input
                type="checkbox"
                checked={selected.some((item) => item._id === row._id)}
                disabled={selected.length >= access.maxTasks && !selected.some((item) => item._id === row._id)}
                onChange={(event) =>
                  setCaptured(
                    event.target.checked ? [...selected, row] : selected.filter((item) => item._id !== row._id)
                  )
                }
              />
              #{row.sequence} · {row.title}
            </label>
          ))}
        </fieldset>
        <p className="text-12">{selected.length} selected</p>
        {view === "active" && !confirmation && !propertiesEditing && !membershipsEditing && (
          <Button variant="secondary" disabled={!selected.length} onClick={() => setPropertiesEditing(true)}>
            Edit selected properties
          </Button>
        )}
        {view === "active" && !confirmation && !propertiesEditing && !membershipsEditing && (
          <Button variant="secondary" disabled={!selected.length} onClick={() => setMembershipsEditing(true)}>
            Change selected cycle or module
          </Button>
        )}
        {membershipsEditing && (
          <BulkMemberships
            projectId={projectId}
            tasks={selected}
            onClose={() => setMembershipsEditing(false)}
            onSaved={() => {
              setMembershipsEditing(false);
              setCaptured([]);
            }}
          />
        )}
        {propertiesEditing && (
          <BulkProperties
            projectId={projectId}
            tasks={selected}
            onClose={() => setPropertiesEditing(false)}
            onSaved={() => {
              setPropertiesEditing(false);
              setCaptured([]);
            }}
          />
        )}
        {!propertiesEditing &&
          !membershipsEditing &&
          (confirmation ? (
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
                disabled={!selected.length}
                onClick={async () => {
                  setPending(true);
                  setError("");
                  try {
                    await bulk({
                      projectId,
                      operation: confirmation,
                      tasks: selected.map((row) => ({ taskId: row._id, expectedUpdatedAt: row.updatedAt })),
                    });
                    setCaptured([]);
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
          ))}
        <Button
          variant="secondary"
          disabled={pending || propertiesEditing || membershipsEditing}
          onClick={() => {
            setCaptured([]);
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
