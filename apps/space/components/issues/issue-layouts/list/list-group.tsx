import { useState } from "react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { api } from "@summon/convex/api";
import { StateGroupIcon } from "@plane/propel/icons";
import { useIssue } from "@/hooks/store/use-issue";
import { stateGroups } from "@/helpers/issue.helper";
import { IssueBlock } from "./block";
import { HeaderGroupByCard } from "./headers/group-by-card";

export function ListGroup({
  anchor,
  state,
  filters,
  count,
}: {
  anchor: string;
  state: FunctionReturnType<typeof api.publicSharing.index.catalog>["states"][number] | null;
  filters: FunctionArgs<typeof api.publicSharing.index.list>["filters"];
  count: number | undefined;
}) {
  const [expanded, setExpanded] = useState(true);
  const { results, status, loadMore } = useIssue(anchor, state?._id ?? null, filters);
  return (
    <div className="relative flex shrink-0 flex-col border border-transparent">
      <div className="sticky top-0 z-2 w-full shrink-0 border-b border-subtle bg-surface-1">
        <HeaderGroupByCard
          title={state?.name ?? "Unassigned"}
          count={count}
          expanded={expanded}
          toggleListGroup={() => setExpanded(!expanded)}
          icon={state && <StateGroupIcon stateGroup={stateGroups[state.status]} color={state.color} />}
        />
      </div>
      {expanded && (
        <div className="relative">
          {results.map((task) => (
            <IssueBlock key={task._id} task={task} />
          ))}
          {status === "LoadingFirstPage" && (
            <div role="status" className="h-11 animate-pulse bg-layer-1" aria-label="Loading work items" />
          )}
          {(status === "CanLoadMore" || status === "LoadingMore") && (
            <button
              type="button"
              disabled={status === "LoadingMore"}
              onClick={() => loadMore(50)}
              className="flex h-11 w-full items-center border-t border-subtle px-6 text-13 text-accent-primary"
            >
              {status === "LoadingMore" ? "Loading…" : "Load more ↓"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
