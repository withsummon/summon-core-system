import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Link } from "react-router";
import { Button } from "@plane/propel/button";
import { PanelRight } from "lucide-react";
import { CycleSidebar } from "./overview";
import { CycleTasks } from "./tasks";
import { useCycleClock } from "./use-cycle-clock";
import { useLocalStorage } from "@plane/hooks";
import { PageHead } from "@/components/core/page-title";
type Address = FunctionReturnType<typeof api.navigation.address.resolveProjectId>;

export function CycleDetails({ address, cycleId }: { address: Address; cycleId: string }) {
  const [now] = useCycleClock();
  const cycle = useQuery(api.cycles.index.address, { projectId: address.project._id, cycleId });
  const { storedValue: collapsed, setValue: setCollapsed } = useLocalStorage("cycle_sidebar_collapsed", false);
  if (cycle === undefined)
    return (
      <p role="status" className="p-6">
        Loading cycle…
      </p>
    );
  if (cycle === null)
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-18 font-medium">Cycle does not exist</h1>
        <p className="text-13 text-secondary">This cycle is unavailable or belongs to another project.</p>
        <Link
          to={`/${address.workspace.slug}/projects/${address.project._id}/cycles/`}
          className="text-accent-secondary"
        >
          View other cycles
        </Link>
      </div>
    );
  return (
    <>
      <PageHead title={`${address.project.name} - ${cycle.name}`} />
      <div className="relative flex h-full min-h-0 flex-col bg-surface-1">
        <div className="flex items-center justify-between gap-3 border-b border-subtle px-5 py-2">
          <h1 className="truncate text-14 font-medium">{cycle.name}</h1>
          <Button
            variant="secondary"
            size="sm"
            aria-label={collapsed ? "Show cycle details" : "Hide cycle details"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            <PanelRight className="size-4" />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto">
            {cycle.deleted ? (
              <div className="space-y-2 p-6">
                <p>This cycle is in Trash. Restore it to view its work items.</p>
                <Link
                  className="text-accent-secondary"
                  to={`/${address.workspace.slug}/projects/${address.project._id}/cycles/?cycleView=trash`}
                >
                  Open cycle Trash
                </Link>
              </div>
            ) : null}
            <CycleTasks cycle={cycle} address={address} />
          </div>
          <aside
            hidden={Boolean(collapsed)}
            aria-label="Cycle details"
            className="absolute right-0 z-13 h-full w-full max-w-[21.5rem] overflow-y-auto border-l border-subtle bg-surface-1 shadow-raised-200 lg:relative lg:shrink-0"
          >
            <CycleSidebar cycle={cycle} address={address} now={now} onClose={() => setCollapsed(true)} />
          </aside>
        </div>
      </div>
    </>
  );
}
