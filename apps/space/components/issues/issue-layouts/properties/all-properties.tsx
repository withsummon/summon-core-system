import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { IssueBlockDate } from "./due-date";
import { IssueBlockLabels } from "./labels";
import { IssueBlockPriority } from "./priority";
import { IssueBlockState } from "./state";

export function IssueProperties({
  task,
  className,
}: {
  task: FunctionReturnType<typeof api.publicSharing.index.list>["page"][number];
  className: string;
}) {
  return (
    <div className={className}>
      <div className="h-5">
        <IssueBlockState stateId={task.stateId} />
      </div>
      <div className="h-5">
        <IssueBlockPriority priority={task.priority} />
      </div>
      <div className="h-5">
        <IssueBlockLabels labelIds={task.labelIds} />
      </div>
      {task.targetDate !== null && (
        <div className="h-5">
          <IssueBlockDate targetDate={task.targetDate} status={task.status} />
        </div>
      )}
    </div>
  );
}
