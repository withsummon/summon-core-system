import { useContext, useState } from "react";
import { Outlet, useNavigate, useOutletContext, useParams, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Command } from "cmdk";
import { useTheme } from "next-themes";
import { useTranslation } from "@plane/i18n";
import type { WorkspaceSession } from "@/app/native-workspace";
import darkModulesAsset from "@/app/assets/empty-state/disabled-feature/modules-dark.webp?url";
import lightModulesAsset from "@/app/assets/empty-state/disabled-feature/modules-light.webp?url";
import { DetailedEmptyState } from "@/components/empty-state/detailed-empty-state-root";
import { PreservedWorkspaceShell } from "@/components/workspace/native-shell/workspace-shell";
import { useStickiesCommands } from "@/components/stickies/native/provider";
import { Dialog } from "@plane/propel/dialog";
import { ModuleIcon, ModuleStatusIcon } from "@plane/propel/icons";
import { ModalCore } from "@plane/ui";
import { ModuleActionProvider, ModuleContextCommands, ModuleCreateContext } from "./actions";
import { ModuleBoundary } from "./actions";
import { PowerKModalCommandItem } from "@/components/power-k/ui/modal/command-item";
type Address = FunctionReturnType<typeof api.navigation.address.resolveProjectId>;

export function ModuleRouteShell() {
  const session = useOutletContext<WorkspaceSession>();
  const { projectId, moduleId } = useParams();
  const [params] = useSearchParams();
  const selectedModule = moduleId ?? params.get("peekModule");
  const [selecting, setSelecting] = useState<Address | null>(null);
  const commands = useStickiesCommands();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const address = useQuery(
    api.navigation.address.resolveProjectId,
    projectId ? { workspaceId: session.workspace._id, projectId } : "skip"
  );
  const config = useQuery(api.projects.features.get, address ? { projectId: address.project._id } : "skip");
  return (
    <ModuleActionProvider
      projectId={address?.project._id}
      workspaceSlug={session.workspace.slug}
      onCreated={(createdProjectId, createdModuleId) =>
        navigate(`/${session.workspace.slug}/projects/${createdProjectId}/modules/${createdModuleId}/`)
      }
    >
      <PreservedWorkspaceShell
        {...session}
        onCreateSticky={commands.create}
        onOpenStickies={commands.openAll}
        beforeLeave={commands.flushAll}
        commands={(close) =>
          address &&
          config?.features.modules && (
            <ModuleCommandItems
              address={address}
              moduleId={selectedModule}
              close={close}
              onOpen={() => setSelecting(address)}
            />
          )
        }
      >
        <div className="flex h-full min-h-0 flex-col">
          {!address || !config ? (
            <p role="status" className="p-6">
              Loading modules…
            </p>
          ) : !config.features.modules ? (
            <div className="flex h-full items-center justify-center">
              <DetailedEmptyState
                title={t("disabled_project.empty_state.module.title")}
                description={t("disabled_project.empty_state.module.description")}
                assetPath={resolvedTheme === "light" ? lightModulesAsset : darkModulesAsset}
                primaryButton={{
                  text: t("disabled_project.empty_state.module.primary_button.text"),
                  onClick: () =>
                    navigate(`/${session.workspace.slug}/settings/projects/${address.project._id}/features/modules`),
                  disabled: !config.canConfigure,
                }}
              />
            </div>
          ) : (
            <Outlet context={address} />
          )}
        </div>
      </PreservedWorkspaceShell>
      {selecting && (
        <ModulePickerDialog
          address={selecting}
          onClose={() => setSelecting(null)}
          onSelect={(chosenModuleId) => {
            setSelecting(null);
            navigate(`/${selecting.workspace.slug}/projects/${selecting.project._id}/modules/${chosenModuleId}/`);
          }}
        />
      )}
    </ModuleActionProvider>
  );
}

function ModuleCommandItems({
  address,
  moduleId,
  close,
  onOpen,
}: {
  address: Address;
  moduleId: string | null;
  close: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const create = useContext(ModuleCreateContext);
  const catalogue = useQuery(api.modules.index.catalogue, { projectId: address.project._id });
  if (!create) throw new Error("Module commands require their project route owner.");
  return (
    <>
      {catalogue?.canWrite && (
        <PowerKModalCommandItem
          icon={ModuleIcon}
          label={t("power_k.creation_actions.create_module")}
          onSelect={() => {
            close();
            create();
          }}
        />
      )}
      <PowerKModalCommandItem
        icon={ModuleIcon}
        label={t("power_k.navigation_actions.open_project_module")}
        onSelect={() => {
          close();
          onOpen();
        }}
      />
      {moduleId && (
        <ModuleBoundary key={moduleId} onBack={close} unavailable={<></>}>
          <ModuleContextCommands projectId={address.project._id} moduleId={moduleId} close={close} />
        </ModuleBoundary>
      )}
    </>
  );
}

function ModulePickerDialog({
  address,
  onClose,
  onSelect,
}: {
  address: Address;
  onClose: () => void;
  onSelect: (moduleId: FunctionReturnType<typeof api.modules.index.get>["_id"]) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const catalogue = useQuery(api.modules.index.catalogue, { projectId: address.project._id });
  const modules = usePaginatedQuery(
    api.modules.index.directory,
    catalogue
      ? {
          projectId: address.project._id,
          view: "active",
          order: "created_at",
          filters: { ...catalogue.filters, search },
        }
      : "skip",
    { initialNumItems: 30 }
  );
  return (
    <ModalCore isOpen handleClose={onClose}>
      <div className="space-y-4 p-5">
        <Dialog.Title className="text-18 font-medium">
          {t("power_k.navigation_actions.open_project_module")}
        </Dialog.Title>
        <Command shouldFilter={false}>
          <Command.Input
            value={search}
            onValueChange={setSearch}
            aria-label={t("power_k.page_placeholders.open_project_module")}
            placeholder={t("power_k.page_placeholders.open_project_module")}
            className="mb-3 w-full border-b border-subtle bg-transparent py-2 text-14 outline-none"
          />
          <Command.List className="max-h-80 overflow-auto">
            {modules.results.map((module) => (
              <PowerKModalCommandItem
                key={module._id}
                value={module.name}
                iconNode={<ModuleStatusIcon status={module.status} className="size-3.5" />}
                label={module.name}
                onSelect={() => onSelect(module._id)}
              />
            ))}
            {modules.status === "CanLoadMore" && (
              <PowerKModalCommandItem label="Load more modules" onSelect={() => modules.loadMore(30)} />
            )}
            {modules.status === "Exhausted" && !modules.results.length && (
              <p className="p-3 text-13 text-secondary">No modules found.</p>
            )}
            {(modules.status === "LoadingFirstPage" || modules.status === "LoadingMore") && (
              <p role="status" className="p-3 text-13 text-secondary">
                Loading modules…
              </p>
            )}
          </Command.List>
        </Command>
      </div>
    </ModalCore>
  );
}
