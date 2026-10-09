import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { cyclePhase } from "@summon/convex/cycle-calendar";
import { Button } from "@plane/propel/button";
import { CycleGroupIcon } from "@plane/propel/icons";
import { FavoriteToggle } from "../favorites/toggle";
import { CycleActions } from "./actions";
import { CycleEdit } from "./forms";
import { CycleProgress } from "./progress";
import { CycleTransfers } from "./transfer";
import { useCycleClock } from "./use-cycle-clock";
import { useTranslation } from "@plane/i18n";
import { PowerKModalCommandItem } from "@/components/power-k/ui/modal/command-item";
import { LinkIcon } from "@plane/propel/icons";
import { copyTextToClipboard } from "@plane/utils";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Star, StarOff } from "lucide-react";
type Address = FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
type Cycle = NonNullable<FunctionReturnType<typeof api.cycles.index.address>>;

export function CycleContextCommands({
  address,
  cycleId,
  closePalette,
}: {
  address: Address;
  cycleId: string | null;
  closePalette: () => void;
}) {
  const { t } = useTranslation();
  const cycle = useQuery(api.cycles.index.address, cycleId ? { projectId: address.project._id, cycleId } : "skip");
  if (!cycle) return null;
  const href = `/${address.workspace.slug}/projects/${address.project._id}/cycles/${cycle._id}/`;
  return (
    <>
      {!cycle.deleted && (
        <FavoriteToggle
          workspaceId={cycle.workspaceId}
          target={{ type: "cycle", id: cycle._id }}
          render={(state, toggle, pending) => (
            <PowerKModalCommandItem
              icon={state.isFavorite ? StarOff : Star}
              value={`toggle_cycle_favorite ${t(state.isFavorite ? "power_k.contextual_actions.cycle.remove_from_favorites" : "power_k.contextual_actions.cycle.add_to_favorites")}`}
              label={t(
                state.isFavorite
                  ? "power_k.contextual_actions.cycle.remove_from_favorites"
                  : "power_k.contextual_actions.cycle.add_to_favorites"
              )}
              isDisabled={pending || state.blockedByFolder}
              onSelect={() => {
                closePalette();
                void toggle();
              }}
            />
          )}
        />
      )}
      <PowerKModalCommandItem
        icon={LinkIcon}
        value={`copy_cycle_url ${t("power_k.contextual_actions.cycle.copy_url")}`}
        label={t("power_k.contextual_actions.cycle.copy_url")}
        onSelect={() => {
          closePalette();
          copyTextToClipboard(new URL(href, window.location.origin).href)
            .then(() =>
              setToast({
                type: TOAST_TYPE.SUCCESS,
                title: t("power_k.contextual_actions.cycle.copy_url_toast_success"),
              })
            )
            .catch(() =>
              setToast({ type: TOAST_TYPE.ERROR, title: t("power_k.contextual_actions.cycle.copy_url_toast_error") })
            );
        }}
      />
    </>
  );
}

export function CycleOverview({
  cycleId,
  address,
  onClose,
}: {
  cycleId: string;
  address: Address;
  onClose: () => void;
}) {
  const [now] = useCycleClock();
  const cycle = useQuery(api.cycles.index.address, { projectId: address.project._id, cycleId });
  if (cycle === undefined)
    return (
      <p role="status" className="p-4">
        Loading cycle…
      </p>
    );
  if (cycle === null)
    return (
      <div className="space-y-3 p-4">
        <p role="alert">This cycle is unavailable.</p>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  return <CycleSidebar cycle={cycle} address={address} now={now} onClose={onClose} />;
}

export function CycleSidebar({
  cycle,
  address,
  now,
  onClose,
}: {
  cycle: Cycle;
  address: Address;
  now: number;
  onClose: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const capabilities = useQuery(api.cycles.index.get, { cycleId: cycle._id, now });
  const phase = cyclePhase(cycle, now);
  const href = `/${address.workspace.slug}/projects/${address.project._id}/cycles/${cycle._id}/`;
  return (
    <div className="space-y-4 px-4 py-3.5">
      <header className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-13 capitalize">
          <CycleGroupIcon cycleGroup={phase} className="size-4" />
          {phase}
          {cycle.archived ? " · Archived" : cycle.deleted ? " · Deleted" : ""}
        </span>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </header>
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 text-18 font-semibold break-words">{cycle.name}</h2>
        <CycleActions
          cycle={cycle}
          href={href}
          onEdit={() => setEditing(true)}
          onTransfer={() => setTransferring(true)}
        />
      </div>
      <Link to={href} className="text-12 text-accent-secondary">
        Open cycle
      </Link>
      <dl className="space-y-3 text-13">
        <div>
          <dt className="text-tertiary">Start date</dt>
          <dd>{cycle.startDate ?? "Not scheduled"}</dd>
        </div>
        <div>
          <dt className="text-tertiary">End date</dt>
          <dd>{cycle.endDate ?? "Not scheduled"}</dd>
        </div>
        <div>
          <dt className="text-tertiary">Timezone</dt>
          <dd>{cycle.timezone}</dd>
        </div>
      </dl>
      {capabilities?.canEdit && (
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          Edit dates and details
        </Button>
      )}
      {cycle.description && (
        <p className="text-13 break-words whitespace-pre-wrap text-secondary">{cycle.description}</p>
      )}
      {!cycle.deleted && (
        <>
          <FavoriteToggle workspaceId={cycle.workspaceId} target={{ type: "cycle", id: cycle._id }} />
          <CycleProgress cycleId={cycle._id} />
        </>
      )}
      <CycleTransfers
        cycle={cycle}
        open={transferring || params.has("cycleTransfer")}
        onOpenChange={(open) => {
          setTransferring(open);
          if (!open)
            setParams((current) => {
              const next = new URLSearchParams(current);
              next.delete("cycleTransfer");
              return next;
            });
        }}
      />
      {editing && <CycleEdit cycle={cycle} canWrite={cycle.canWrite} onClose={() => setEditing(false)} />}
    </div>
  );
}
