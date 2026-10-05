import type { FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { StateGroupIcon } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
import { stateGroups } from "@/helpers/issue.helper";
import { useStates } from "@/hooks/store/use-state";

export function IssueBlockState({
  stateId,
  shouldShowBorder = true,
}: {
  stateId: FunctionReturnType<typeof api.publicSharing.index.list>["page"][number]["stateId"];
  shouldShowBorder?: boolean;
}) {
  const states = useStates();
  const state = states?.find((item) => item._id === stateId);
  return (
    <Tooltip tooltipHeading="State" tooltipContent={state?.name ?? "Unassigned"}>
      <div
        className={cn("flex h-full w-full items-center justify-between gap-1 rounded-sm px-2.5 py-1 text-11", {
          "border-[0.5px] border-strong": shouldShowBorder,
        })}
      >
        <div className="flex w-full items-center gap-1.5">
          {state && <StateGroupIcon stateGroup={stateGroups[state.status]} color={state.color} />}
          <span>{state?.name ?? "Unassigned"}</span>
        </div>
      </div>
    </Tooltip>
  );
}
