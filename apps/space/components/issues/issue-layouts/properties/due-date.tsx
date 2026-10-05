import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { DueDatePropertyIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
import { shouldHighlightIssueDueDate, stateGroups } from "@/helpers/issue.helper";
import { renderFormattedDate } from "@/helpers/date-time.helper";

export function IssueBlockDate({
  targetDate,
  status,
  shouldShowBorder = true,
}: {
  targetDate: FunctionReturnType<typeof api.publicSharing.index.list>["page"][number]["targetDate"];
  status: FunctionReturnType<typeof api.publicSharing.index.list>["page"][number]["status"];
  shouldShowBorder?: boolean;
}) {
  const formattedDate = renderFormattedDate(targetDate);
  return (
    <Tooltip tooltipHeading="Due Date" tooltipContent={formattedDate}>
      <div
        className={cn("flex h-full items-center gap-1 rounded-sm px-2.5 py-1 text-11 text-primary", {
          "text-danger-primary": shouldHighlightIssueDueDate(targetDate, stateGroups[status]),
          "border-[0.5px] border-strong": shouldShowBorder,
        })}
      >
        <DueDatePropertyIcon className="size-3 shrink-0" />
        {formattedDate}
      </div>
    </Tooltip>
  );
}
