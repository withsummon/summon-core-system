import { useEffect } from "react";
import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { IssueAppliedFilters } from "@/components/issues/filters/applied-filters/root";
import { IssuePeekOverview } from "@/components/issues/peek-overview";
import { useIssueFilter } from "@/hooks/store/use-issue-filter";
import { LogoSpinner } from "@/components/common/logo-spinner";
import { ListGroup } from "./list/list-group";
import { KanbanGroup } from "./kanban/kanban-group";

export function IssuesLayoutsRoot({
  peekId,
  publishSettings,
}: {
  peekId: string | undefined;
  publishSettings: FunctionReturnType<typeof api.publicSharing.index.settings>;
}) {
  const { catalog, filters, invalid, layout, clear } = useIssueFilter();
  const { results, status, loadMore } = usePaginatedQuery(
    api.publicSharing.index.summary,
    catalog && !invalid ? { anchor: publishSettings.anchor, filters } : "skip",
    { initialNumItems: 100 }
  );
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(100);
  }, [status, loadMore]);
  const total = (stateId: FunctionReturnType<typeof api.publicSharing.index.summary>["page"][number]["stateId"]) =>
    status === "Exhausted" ? results.filter((task) => task.stateId === stateId).length : undefined;
  const Group = layout === "list" ? ListGroup : KanbanGroup;
  return (
    <div className="relative size-full overflow-hidden">
      {peekId && <IssuePeekOverview key={peekId} anchor={publishSettings.anchor} peekId={peekId} />}
      <div className="relative flex size-full flex-col overflow-hidden">
        <IssueAppliedFilters />
        {invalid ? (
          <div role="alert" className="p-6">
            <p>Some selected filters are unavailable. Remove them to continue.</p>
            <button type="button" onClick={clear} className="mt-3 text-accent-primary underline">
              Clear filters
            </button>
          </div>
        ) : !catalog ? (
          <div className="grid size-full place-items-center">
            <LogoSpinner />
          </div>
        ) : status === "Exhausted" && results.length === 0 ? (
          <div role="status" className="grid size-full place-items-center p-6 text-secondary">
            No work items found.
          </div>
        ) : (
          <div
            className={
              layout === "list"
                ? "vertical-scrollbar scrollbar-lg size-full overflow-auto"
                : "relative flex size-full gap-5 overflow-auto p-5"
            }
          >
            {catalog.states.map((state) => (
              <Group
                key={state._id}
                anchor={publishSettings.anchor}
                state={state}
                filters={filters}
                count={total(state._id)}
              />
            ))}
            <Group
              key="unassigned"
              anchor={publishSettings.anchor}
              state={null}
              filters={filters}
              count={total(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
