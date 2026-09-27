import { statusOptions } from "../tasks/options";
import { useState } from "react";
import { Button } from "@plane/propel/button";
import type { CycleProgress } from "./progress-summary";
type Kind = keyof Pick<CycleProgress, "statuses" | "assignees" | "labels">;
const titles: Record<Kind, string> = { statuses: "Status", assignees: "Assignees", labels: "Labels" };
export function Distribution({ kind, rows }: { kind: Kind; rows: CycleProgress["labels"] }) {
  const title = titles[kind];
  const [visible, setVisible] = useState(50);
  return (
    <div className="min-w-0">
      <h5 className="text-14 font-medium">{title}</h5>
      <ul className="text-14">
        {rows.slice(0, visible).map((row) => (
          <li key={row.id ?? "none"} className="break-words">
            {kind === "statuses"
              ? (statusOptions.find((option) => option.value === row.id)?.label ?? row.name)
              : row.name}
            : {row.count} tasks · {row.numericEstimates} numeric estimates
            {row.unquantifiedEstimates > 0 ? ` · ${row.unquantifiedEstimates} nonnumeric estimates` : ""}
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
