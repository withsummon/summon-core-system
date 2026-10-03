import { useState } from "react";
import { Outlet, Link, useOutletContext, useParams, useSearchParams, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import { Command } from "cmdk";
import { useTranslation } from "@plane/i18n";
import { api } from "@summon/convex/api";
import type { WorkspaceSession } from "@/components/workspace/native-shell/session";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { Row } from "@plane/ui";
import { Button } from "@plane/propel/button";
import { CycleIcon } from "@plane/propel/icons";
import { PageHead } from "@/components/core/page-title";
import { CycleForm } from "./forms";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { PowerKModalCommandItem } from "@/components/power-k/ui/modal/command-item";
import { PowerKMenuBuilder } from "@/components/power-k/menus/builder";
import { CycleContextCommands } from "./overview";

export function CycleRouteLayout({ archived = false }: { archived?: boolean }) {
  const session = useOutletContext<WorkspaceSession>();
  const { t } = useTranslation();
  const { projectId, cycleId } = useParams();
  const [params, setParams] = useSearchParams();
  const stickyCommands = useStickiesCommands();
  const [picking, setPicking] = useState(false);
  const address = useQuery(
    api.navigation.address.resolveProjectId,
    projectId ? { workspaceId: session.workspace._id, projectId } : "skip"
  );
  const feature = useQuery(api.projects.features.get, address ? { projectId: address.project._id } : "skip");
  const selected = cycleId ?? params.get("peekCycle");
  const canWrite = address?.projectRole !== "guest" && address?.workspaceRole !== "guest";
  const create = () =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("createCycle", "1");
      return next;
    });
  const close = () =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("createCycle");
      return next;
    });
  return (
    <PreservedWorkspaceShell
      {...session}
      onCreateSticky={stickyCommands.create}
      onOpenStickies={stickyCommands.openAll}
      beforeLeave={stickyCommands.flushAll}
      commands={(closePalette) =>
        address &&
        feature?.features.cycles && (
          <>
            {canWrite && (
              <PowerKModalCommandItem
                icon={CycleIcon}
                value={`create_cycle ${t("power_k.creation_actions.create_cycle")}`}
                label={t("power_k.creation_actions.create_cycle")}
                onSelect={() => {
                  closePalette();
                  create();
                }}
              />
            )}
            <PowerKModalCommandItem
              icon={CycleIcon}
              value={`open_project_cycle ${t("power_k.navigation_actions.open_project_cycle")}`}
              label={t("power_k.navigation_actions.open_project_cycle")}
              onSelect={() => {
                closePalette();
                setPicking(true);
              }}
            />
            <CycleContextCommands address={address} cycleId={selected} closePalette={closePalette} />
          </>
        )
      }
    >
      {!address || !feature ? (
        <p role="status" className="p-6">
          Loading cycles…
        </p>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <PageHead title={`${address.project.name} - ${archived ? "Archived cycles" : "Cycles"}`} />
          <Row className="z-[18] flex h-11 shrink-0 items-center justify-between gap-2 border-b border-subtle bg-surface-1">
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-13">
              <Link className="truncate" to={`/${address.workspace.slug}/projects/${address.project._id}/issues/`}>
                {address.project.name}
              </Link>
              <span className="text-tertiary">/</span>
              <CycleIcon className="size-4 text-tertiary" />
              <Link to={`/${address.workspace.slug}/projects/${address.project._id}/cycles/`}>
                {archived ? "Archived cycles" : "Cycles"}
              </Link>
            </nav>
            {canWrite && feature.features.cycles && !archived && (
              <Button size="lg" onClick={create}>
                Add cycle
              </Button>
            )}
          </Row>
          <ContentWrapper>
            {feature.features.cycles ? (
              <Outlet context={address} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <h1 className="text-18 font-medium">Cycles are disabled</h1>
                <p className="text-13 text-secondary">
                  Enable cycles in project settings to plan work in time periods.
                </p>
                <Link
                  to={`/${address.workspace.slug}/settings/projects/${address.project._id}/features/cycles/`}
                  className="text-accent-secondary"
                >
                  Cycle settings
                </Link>
              </div>
            )}
          </ContentWrapper>
          {params.has("createCycle") && (
            <CycleForm
              projectId={address.project._id}
              cycle={null}
              canSave={canWrite && feature.features.cycles}
              onDone={(_, allow) => {
                if (allow) close();
              }}
              onCancel={(allow) => {
                if (allow) close();
              }}
            />
          )}
          {picking && <CyclePicker address={address} onClose={() => setPicking(false)} />}
        </div>
      )}
    </PreservedWorkspaceShell>
  );
}

function CyclePicker({
  address,
  onClose,
}: {
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [now] = useState(Date.now);
  const cycles = usePaginatedQuery(
    api.cycles.index.browse,
    { projectId: address.project._id, view: "all", now, search, phases: [], startDate: null, endDate: null },
    { initialNumItems: 30 }
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Panel width={EDialogWidth.MD}>
        <div className="p-3">
          <Dialog.Title className="mb-3 text-14 font-medium">
            {t("power_k.navigation_actions.open_project_cycle")}
          </Dialog.Title>
          <Command shouldFilter={false}>
            <Command.Input
              value={search}
              onValueChange={setSearch}
              maxLength={255}
              aria-label={t("power_k.page_placeholders.open_project_cycle")}
              placeholder={t("power_k.page_placeholders.open_project_cycle")}
              className="mb-3 w-full rounded-md border border-subtle bg-layer-1 p-2 text-13 outline-none focus-visible:ring-2 focus-visible:ring-accent-strong/40"
            />
            <Command.List className="max-h-80 overflow-y-auto [&_[cmdk-item]]:flex [&_[cmdk-item]]:cursor-pointer [&_[cmdk-item]]:items-center [&_[cmdk-item]]:justify-between [&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:p-2 [&_[cmdk-item]]:text-13 [&_[cmdk-item][data-selected=true]]:bg-layer-1">
              {cycles.status === "LoadingFirstPage" ? (
                <p role="status">{t("common.loading")}</p>
              ) : (
                <PowerKMenuBuilder
                  items={cycles.results}
                  getIcon={() => CycleIcon}
                  getKey={(item) => item._id}
                  getLabel={(item) => item.name}
                  getValue={(item) => `${item._id}-${item.name}`}
                  onSelect={(item) => {
                    onClose();
                    navigate(`/${address.workspace.slug}/projects/${address.project._id}/cycles/${item._id}/`);
                  }}
                  emptyText="No cycles found"
                />
              )}
            </Command.List>
          </Command>
          <div className="mt-3 flex justify-end gap-2">
            {cycles.status !== "Exhausted" && (
              <Button
                variant="secondary"
                size="sm"
                disabled={cycles.status !== "CanLoadMore"}
                loading={cycles.status === "LoadingMore"}
                onClick={() => cycles.loadMore(30)}
              >
                {t("common.load_more")}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t("close")}
            </Button>
          </div>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
