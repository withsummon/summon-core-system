import { statusOptions } from "../options";
import type { Doc } from "@summon/convex/data-model";
import { useState } from "react";
import { Button } from "@plane/propel/button";
import type { TaskProgress } from "./summary";
type Kind = keyof Pick<TaskProgress, "statuses" | "assignees" | "labels">;
const titles: Record<Kind, string> = { statuses: "Status", assignees: "Assignees", labels: "Labels" };
function taskCount(count: number) {
  return `${count} task${count === 1 ? "" : "s"}`;
}
export function Distribution({
  kind,
  rows,
}: {
  kind: Kind;
  rows: (TaskProgress["labels"][number] | Doc<"cycleTransfers">["snapshot"]["labels"][number])[];
}) {
  const title = titles[kind];
  const [visible, setVisible] = useState(50);
  return (
    <div className="min-w-0">
      <h4 className="text-14 font-medium">{title}</h4>
      <ul className="text-14">
        {rows.slice(0, visible).map((row) => (
          <li key={row.id ?? "none"} className="break-words">
            {kind === "statuses"
              ? (statusOptions.find((option) => option.value === row.id)?.label ?? row.name)
              : row.name}
            : {taskCount(row.count)} · {row.numericEstimates} numeric estimates
            {row.unquantifiedEstimates > 0 ? ` · ${row.unquantifiedEstimates} nonnumeric estimates` : ""}
            {kind !== "statuses" && "completed" in row && (
              <div className="mt-1 text-12 text-secondary">
                Completed: {taskCount(row.completed.count)} · {row.completed.numericEstimates} numeric estimates
                <br />
                Pending: {taskCount(row.pending.count)} · {row.pending.numericEstimates} numeric estimates
              </div>
            )}
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
