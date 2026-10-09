import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { cyclePhase } from "@summon/convex/cycle-calendar";
import { Button } from "@plane/propel/button";
import { DatePicker } from "@plane/propel/date-picker";
import { Input } from "@plane/propel/input";
import { MultiSelect } from "@plane/propel/select";
import { CycleGroupIcon } from "@plane/propel/icons";
import { CollapsiblePrimitive } from "@plane/propel/collapsible";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import { ListItem } from "@/components/core/list";
import { SummonField } from "@/components/summon/forms";
import { CycleListGroupHeader } from "@/components/cycles/list/cycle-list-group-header";
import { CycleModuleListLayoutLoader } from "@/components/ui/loader/cycle-module-list-loader";
import { FavoriteToggle } from "../favorites/toggle";
import { CycleActions } from "./actions";
import { CycleEdit } from "./forms";
import { CycleOverview } from "./overview";
import { CycleProgress } from "./progress";
import { useCycleClock } from "./use-cycle-clock";

type Address = FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
type Filters = FunctionArgs<typeof api.cycles.index.browse>;
type Cycle = FunctionReturnType<typeof api.cycles.index.get>;
export const phaseOptions = [
  { value: "current", label: "Active" },
  { value: "upcoming", label: "Upcoming" },
  { value: "draft", label: "Draft" },
  { value: "completed", label: "Completed" },
] as const satisfies { value: Filters["phases"][number]; label: string }[];
const cycleViews = [
  { value: "all", label: "All cycles", path: "/cycles/" },
  { value: "archived", label: "Archived cycles", path: "/archives/cycles/" },
  { value: "trash", label: "Trash", path: "/cycles/?cycleView=trash" },
] as const satisfies { value: Filters["view"]; label: string; path: string }[];
const emptyTitles = {
  all: "Plan your work in cycles",
  archived: "No archived cycles",
  trash: "No deleted cycles",
} satisfies Record<Filters["view"], string>;

export function ProjectCycles({
  address,
  onCreate,
  view = "all",
}: {
  address: Address;
  onCreate: () => void;
  view?: Filters["view"];
}) {
  const [params, setParams] = useSearchParams();
  const [queryClock, setQueryClock] = useState(Date.now);
  const [now] = useCycleClock();
  const phases = phaseOptions
    .filter((option) => params.getAll("cyclePhase").includes(option.value))
    .map((option) => option.value);
  const rows = usePaginatedQuery(
    api.cycles.index.browse,
    {
      projectId: address.project._id,
      view,
      now: queryClock,
      search: params.get("cycleSearch") ?? "",
      phases,
      startDate: params.get("cycleStart") || null,
      endDate: params.get("cycleEnd") || null,
    },
    { initialNumItems: 30 }
  );
  const [editing, setEditing] = useState<Cycle | null>(null);
  const canWrite = address.projectRole !== "guest" && address.workspaceRole !== "guest";
  const peek = params.get("peekCycle");
  const closePeek = () =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("peekCycle");
      next.delete("cycleTransfer");
      return next;
    });
  const base = `/${address.workspace.slug}/projects/${address.project._id}`;
  const filtered = [params.get("cycleSearch"), phases.length, params.get("cycleStart"), params.get("cycleEnd")].some(
    Boolean
  );
  return (
    <div className="relative flex h-full min-h-0 flex-col bg-surface-1">
      <CycleFilters />
      <nav
        aria-label="Cycle views"
        className="flex flex-wrap items-center gap-4 border-b border-subtle px-5 py-2 text-13"
      >
        {cycleViews.map(({ value, label, path }) => (
          <Link key={value} aria-current={view === value ? "page" : undefined} to={`${base}${path}`}>
            {label}
          </Link>
        ))}
        <Button className="ml-auto" size="sm" variant="ghost" onClick={() => setQueryClock(Date.now())}>
          Refresh
        </Button>
      </nav>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto">
          {rows.status === "LoadingFirstPage" ? (
            <CycleModuleListLayoutLoader />
          ) : rows.status === "Exhausted" && !rows.results.length ? (
            <EmptyStateDetailed
              assetKey="cycle"
              title={filtered ? "No matching cycles" : emptyTitles[view]}
              description={
                filtered
                  ? "Change the search or filters to see other cycles."
                  : "Cycles organize work within a defined time period."
              }
              actions={
                view === "all" && !filtered
                  ? [{ label: "Add cycle", onClick: onCreate, variant: "primary", disabled: !canWrite }]
                  : []
              }
            />
          ) : view === "all" ? (
            phaseOptions.map(({ value, label }) => {
              const group = rows.results.filter((cycle) => cyclePhase(cycle, now) === value);
              return (
                group.length > 0 && (
                  <CollapsiblePrimitive.Root
                    key={value}
                    defaultOpen={value !== "completed"}
                    render={(rootProps, { open }) => (
                      <section {...rootProps}>
                        <CollapsiblePrimitive.Trigger className="sticky top-0 z-2 w-full border-b border-subtle bg-layer-1">
                          <CycleListGroupHeader type={value} title={label} isExpanded={open} />
                        </CollapsiblePrimitive.Trigger>
                        <CollapsiblePrimitive.Panel>
                          {group.map((cycle) => (
                            <div key={cycle._id}>
                              <CycleRow
                                cycle={cycle}
                                base={base}
                                now={now}
                                onEdit={() => setEditing(cycle)}
                                onTransfer={() =>
                                  setParams((current) => {
                                    const next = new URLSearchParams(current);
                                    next.set("peekCycle", cycle._id);
                                    next.set("cycleTransfer", "1");
                                    return next;
                                  })
                                }
                              />
                              {value === "current" && <CycleProgress cycleId={cycle._id} layout="active" />}
                            </div>
                          ))}
                        </CollapsiblePrimitive.Panel>
                      </section>
                    )}
                  />
                )
              );
            })
          ) : (
            rows.results.map((cycle) => (
              <CycleRow
                key={cycle._id}
                cycle={cycle}
                base={base}
                now={now}
                onEdit={() => setEditing(cycle)}
                onTransfer={() =>
                  setParams((current) => {
                    const next = new URLSearchParams(current);
                    next.set("peekCycle", cycle._id);
                    next.set("cycleTransfer", "1");
                    return next;
                  })
                }
              />
            ))
          )}
          {rows.status === "CanLoadMore" && (
            <Button variant="secondary" className="m-4" onClick={() => rows.loadMore(30)}>
              Load more cycles
            </Button>
          )}
          {rows.status === "LoadingMore" && (
            <p role="status" className="p-4 text-13 text-secondary">
              Loading more cycles…
            </p>
          )}
        </div>
        {peek && (
          <aside className="absolute right-0 z-13 h-full w-full max-w-[21.5rem] overflow-y-auto border-l border-subtle bg-surface-1 shadow-raised-200 sm:relative sm:shrink-0">
            <CycleOverview key={peek} cycleId={peek} address={address} onClose={closePeek} />
          </aside>
        )}
      </div>
      {editing && <CycleEdit key={editing._id} cycle={editing} canWrite={canWrite} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CycleRow({
  cycle,
  base,
  now,
  onEdit,
  onTransfer,
}: {
  cycle: Cycle;
  base: string;
  now: number;
  onEdit: () => void;
  onTransfer: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [params, setParams] = useSearchParams();
  const phase = cyclePhase(cycle, now);
  const href = `${base}/cycles/${cycle._id}/`;
  return (
    <ListItem
      title={cycle.name}
      itemLink={href}
      parentRef={ref}
      isSidebarOpen={params.has("peekCycle")}
      prependTitleElement={<CycleGroupIcon cycleGroup={phase} className="size-5 text-tertiary" />}
      actionableItems={
        <>
          <Button
            variant="link"
            size="sm"
            onClick={() =>
              setParams((current) => {
                const next = new URLSearchParams(current);
                next.set("peekCycle", cycle._id);
                return next;
              })
            }
          >
            More details
          </Button>
          <span className="text-11 text-tertiary">
            {cycle.startDate && cycle.endDate ? `${cycle.startDate} → ${cycle.endDate}` : "Draft"}
          </span>
          {!cycle.deleted && (
            <FavoriteToggle workspaceId={cycle.workspaceId} target={{ type: "cycle", id: cycle._id }} />
          )}
          <CycleActions cycle={cycle} href={href} onEdit={onEdit} onTransfer={onTransfer} />
        </>
      }
    />
  );
}

function CycleFilters() {
  const [params, setParams] = useSearchParams();
  const [show, setShow] = useState(false);
  const selected = phaseOptions
    .filter((option) => params.getAll("cyclePhase").includes(option.value))
    .map((option) => option.value);
  return (
    <div className="border-b border-subtle px-5 py-2">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const search = data.get("search");
          setParams((current) => {
            const next = new URLSearchParams(current);
            if (typeof search === "string" && search) next.set("cycleSearch", search);
            else next.delete("cycleSearch");
            return next;
          });
        }}
      >
        <Input
          key={params.get("cycleSearch")}
          name="search"
          type="search"
          aria-label="Search cycles"
          placeholder="Search cycles"
          maxLength={255}
          defaultValue={params.get("cycleSearch") ?? ""}
          className="max-w-64"
        />
        <Button type="submit" variant="secondary" size="sm">
          Search
        </Button>
        <Button variant="secondary" size="sm" aria-expanded={show} onClick={() => setShow(!show)}>
          Filters{selected.length ? ` (${selected.length})` : ""}
        </Button>
      </form>
      {show && (
        <div className="grid gap-3 pt-3 sm:grid-cols-3">
          <SummonField label="Status" htmlFor="cycle-phase-filter">
            <MultiSelect
              id="cycle-phase-filter"
              options={[...phaseOptions]}
              value={selected}
              onValueChange={(values) =>
                setParams((current) => {
                  const next = new URLSearchParams(current);
                  next.delete("cyclePhase");
                  values.forEach((value) => next.append("cyclePhase", value));
                  return next;
                })
              }
              placeholder="All statuses"
            />
          </SummonField>
          {(
            [
              { key: "cycleStart", label: "Starts on or after" },
              { key: "cycleEnd", label: "Ends on or before" },
            ] as const
          ).map(({ key, label }) => (
            <SummonField key={key} label={label} htmlFor={key}>
              <DatePicker
                id={key}
                min={key === "cycleEnd" ? params.get("cycleStart") || undefined : undefined}
                max={key === "cycleStart" ? params.get("cycleEnd") || undefined : undefined}
                value={params.get(key) ?? ""}
                onValueChange={(value) =>
                  setParams((current) => {
                    const next = new URLSearchParams(current);
                    if (value) next.set(key, value);
                    else next.delete(key);
                    return next;
                  })
                }
              />
            </SummonField>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setParams((current) => {
                const next = new URLSearchParams(current);
                ["cycleSearch", "cyclePhase", "cycleStart", "cycleEnd"].forEach((key) => next.delete(key));
                return next;
              })
            }
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
