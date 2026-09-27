import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { taskStatusOptions } from "../options";
type Change = NonNullable<FunctionReturnType<typeof api.tasks.activity.list>["page"][number]["changes"]>[number];
function Scalar({ label, before, after }: { label: string; before: string | null; after: string | null }) {
  return (
    <li className="break-words">
      <span className="font-medium">{label}:</span> {before ?? "Not set"} → {after ?? "Not set"}
    </li>
  );
}
function ChangeRow({ change }: { change: Change }) {
  switch (change.field) {
    case "title":
      return <Scalar label="Title" before={change.before} after={change.after} />;
    case "priority":
      return <Scalar label="Priority" before={change.before} after={change.after} />;
    case "startDate":
      return <Scalar label="Start date" before={change.before} after={change.after} />;
    case "targetDate":
      return <Scalar label="Due date" before={change.before} after={change.after} />;
    case "state":
      return (
        <Scalar
          label="State"
          before={change.before.name ?? taskStatusOptions[change.before.status].label}
          after={change.after.name ?? taskStatusOptions[change.after.status].label}
        />
      );
    case "estimate":
      return (
        <Scalar
          label="Estimate"
          before={change.before ? (change.before.value ?? "Unavailable estimate") : null}
          after={change.after ? (change.after.value ?? "Unavailable estimate") : null}
        />
      );
    case "assignees":
    case "labels":
      return (
        <li className="break-words">
          <span className="font-medium">{change.field === "assignees" ? "Assignees" : "Labels"}:</span>
          <ul>
            {change.added.map((item) => (
              <li key={item.id}>
                Added {item.name ?? `Unavailable ${change.field === "assignees" ? "member" : "label"}`}
              </li>
            ))}
            {change.removed.map((item) => (
              <li key={item.id}>
                Removed {item.name ?? `Unavailable ${change.field === "assignees" ? "member" : "label"}`}
              </li>
            ))}
          </ul>
        </li>
      );
  }
}
export function ActivityChanges({ changes }: { changes: Change[] }) {
  return (
    <ul className="space-y-1 text-secondary">
      {changes.map((change) => (
        <ChangeRow key={change.field} change={change} />
      ))}
    </ul>
  );
}
