import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { taskStatusOptions } from "../options";
type Change = NonNullable<FunctionReturnType<typeof api.tasks.activity.list>["page"][number]["changes"]>[number];
const labels = {
  title: "Title",
  priority: "Priority",
  startDate: "Start date",
  targetDate: "Due date",
  archivedAt: "Archived",
  deletedAt: "Deleted",
  cycle: "Cycle",
  state: "State",
  estimate: "Estimate",
  point: "Point",
  assignees: "Assignees",
  labels: "Labels",
  modules: "Modules",
  vote: "Vote",
  link: "Link",
} satisfies Record<Change["field"], string>;
const voteLabels = { 1: "Upvote", "-1": "Downvote" } satisfies Record<
  NonNullable<Extract<Change, { field: "vote" }>["before"]>,
  string
>;
function Scalar({
  label,
  before,
  after,
}: {
  label: string;
  before: string | number | null;
  after: string | number | null;
}) {
  return (
    <li className="break-words">
      <span className="font-medium">{label}:</span> {before ?? "Not set"} → {after ?? "Not set"}
    </li>
  );
}
function CollectionChange({ change }: { change: Extract<Change, { added: unknown }> }) {
  return (
    <li className="break-words">
      <span className="font-medium">{labels[change.field]}:</span>
      <ul>
        {change.added.map((item) => (
          <li key={item.id}>Added {item.name ?? `Unavailable ${change.field}`}</li>
        ))}
        {change.removed.map((item) => (
          <li key={item.id}>Removed {item.name ?? `Unavailable ${change.field}`}</li>
        ))}
      </ul>
    </li>
  );
}
function ChangeRow({ change }: { change: Exclude<Change, { added: unknown } | { field: "vote" }> }) {
  switch (change.field) {
    case "archivedAt":
    case "deletedAt":
      return (
        <Scalar
          label={labels[change.field]}
          before={change.before === null ? "No" : "Yes"}
          after={change.after === null ? "No" : "Yes"}
        />
      );
    case "cycle":
      return (
        <Scalar
          label="Cycle"
          before={change.before ? (change.before.name ?? "Unavailable cycle") : null}
          after={change.after ? (change.after.name ?? "Unavailable cycle") : null}
        />
      );
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
    default:
      return <Scalar label={labels[change.field]} before={change.before} after={change.after} />;
  }
}
export function ActivityChanges({ changes }: { changes: Change[] }) {
  return (
    <ul className="space-y-1 text-secondary">
      {changes.map((change) =>
        "added" in change ? (
          <CollectionChange key={change.field} change={change} />
        ) : change.field === "vote" ? (
          <Scalar
            key={change.field}
            label={labels.vote}
            before={change.before === null ? null : voteLabels[change.before]}
            after={change.after === null ? null : voteLabels[change.after]}
          />
        ) : (
          <ChangeRow key={change.field} change={change} />
        )
      )}
    </ul>
  );
}
