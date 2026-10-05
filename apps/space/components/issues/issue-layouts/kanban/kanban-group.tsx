import type { ComponentProps } from "react";
import { StateGroupIcon } from "@plane/propel/icons";
import { useIssue } from "@/hooks/store/use-issue";
import { stateGroups } from "@/helpers/issue.helper";
import type { ListGroup } from "../list/list-group";
import { KanbanIssueBlock } from "./block";
import { HeaderGroupByCard } from "./headers/group-by-card";

export function KanbanGroup({ anchor, state, filters, count }: ComponentProps<typeof ListGroup>) {
  const { results, status, loadMore } = useIssue(anchor, state?._id ?? null, filters);
  return (
    <div className="relative flex h-full w-80 shrink-0 flex-col rounded-lg bg-layer-1">
      <HeaderGroupByCard
        title={state?.name ?? "Unassigned"}
        count={count}
        icon={state && <StateGroupIcon stateGroup={stateGroups[state.status]} color={state.color} />}
      />
      <div className="vertical-scrollbar flex-1 overflow-y-auto">
        {results.map((task) => (
          <KanbanIssueBlock key={task._id} task={task} />
        ))}
        {status === "LoadingFirstPage" && (
          <div role="status" aria-label="Loading work items" className="m-2 h-24 animate-pulse rounded-lg bg-layer-2" />
        )}
        {(status === "CanLoadMore" || status === "LoadingMore") && (
          <button
            type="button"
            disabled={status === "LoadingMore"}
            onClick={() => loadMore(50)}
            className="w-full p-3 text-13 text-accent-primary"
          >
            {status === "LoadingMore" ? "Loading…" : "Load more ↓"}
          </button>
        )}
      </div>
    </div>
  );
}
