import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { Component, createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@summon/convex/data-model";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { IconButton } from "@plane/propel/icon-button";
import { Menu } from "@plane/propel/menu";
import { MoreHorizontal, Star, StarOff, Users } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { LinkIcon, ModuleStatusIcon } from "@plane/propel/icons";
import { copyTextToClipboard } from "@plane/utils";
import { ModalCore } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { mutationMessage } from "../commercial/forms";
import { ModuleFormModal } from "./forms";
import { ModuleMembers } from "./members";
import { ModuleStatusDialog } from "./properties";
import { PowerKModalCommandItem } from "@/components/power-k/ui/modal/command-item";
import { FavoriteToggle } from "../favorites/toggle";
type Module = FunctionReturnType<typeof api.modules.index.get>;
type Operation = FunctionArgs<typeof api.modules.index.lifecycle>["operation"];
type Action = Operation | "edit" | "members" | "status" | "copy";
const lifecycleLabels = {
  archive: "Archive module",
  unarchive: "Restore module",
  delete: "Delete module",
  restore: "Restore deleted module",
} satisfies Record<Operation, string>;
export const ModuleActionContext = createContext<((module: Module, operation: Action) => void) | null>(null);
export const ModuleCreateContext = createContext<(() => void) | null>(null);

export function ModuleActionProvider({
  projectId,
  workspaceSlug,
  children,
  onCreated,
}: {
  projectId?: Id<"projects">;
  workspaceSlug: string;
  children: ReactNode;
  onCreated: (projectId: Id<"projects">, moduleId: Id<"modules">) => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<{ module: Module; operation: Exclude<Action, "copy"> } | null>(null);
  const [createProject, setCreateProject] = useState<Id<"projects"> | null>(null);
  const create = useCallback(() => {
    if (projectId) setCreateProject(projectId);
  }, [projectId]);
  const open = useCallback(
    (module: Module, operation: Action) => {
      if (operation === "copy") {
        const href = `/${workspaceSlug}/projects/${module.projectId}/modules/${module._id}/`;
        void copyTextToClipboard(new URL(href, window.location.origin).href)
          .then(() =>
            setToast({ type: TOAST_TYPE.SUCCESS, title: t("power_k.contextual_actions.module.copy_url_toast_success") })
          )
          .catch(() =>
            setToast({ type: TOAST_TYPE.ERROR, title: t("power_k.contextual_actions.module.copy_url_toast_error") })
          );
      } else setSelected({ module, operation });
    },
    [workspaceSlug, t]
  );
  return (
    <ModuleCreateContext.Provider value={create}>
      <ModuleActionContext.Provider value={open}>
        {children}
        {createProject && (
          <ModuleFormModal
            projectId={createProject}
            module={null}
            onClose={() => setCreateProject(null)}
            onDone={(moduleId, allow) => {
              setCreateProject(null);
              if (allow) onCreated(createProject, moduleId);
            }}
          />
        )}
        {selected && (
          <ModuleBoundary
            key={`${selected.module._id}:${selected.operation}`}
            onBack={() => setSelected(null)}
            unavailable={
              <ModalCore isOpen handleClose={() => setSelected(null)}>
                <div className="space-y-4 p-5">
                  <Dialog.Title className="text-18 font-medium">This module is unavailable</Dialog.Title>
                  <p role="alert" className="text-14 text-secondary">
                    Your access may have changed. Close this dialog and check the project.
                  </p>
                  <Button variant="secondary" onClick={() => setSelected(null)}>
                    Close
                  </Button>
                </div>
              </ModalCore>
            }
          >
            <ModuleActionDialog selected={selected} projectId={projectId} onClose={() => setSelected(null)} />
          </ModuleBoundary>
        )}
      </ModuleActionContext.Provider>
    </ModuleCreateContext.Provider>
  );
}
function ModuleActionDialog({
  selected,
  projectId,
  onClose,
}: {
  selected: { module: Module; operation: Exclude<Action, "copy"> };
  projectId?: Id<"projects">;
  onClose: () => void;
}) {
  const current = useQuery(
    api.modules.index.address,
    projectId ? { projectId, moduleId: selected.module._id } : "skip"
  );
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  if (current === undefined)
    return (
      <ModalCore isOpen handleClose={onClose}>
        <p role="status" className="p-5">
          Loading module…
        </p>
      </ModalCore>
    );
  if (current === null)
    return (
      <ModalCore isOpen handleClose={onClose}>
        <div className="space-y-4 p-5">
          <p role="alert">This module is unavailable in this project.</p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </ModalCore>
    );
  if (selected.operation === "members")
    return (
      <ModalCore
        isOpen
        handleClose={() => {
          if (!busy) onClose();
        }}
      >
        <div className="space-y-4 p-5">
          <Dialog.Title className="text-18 font-medium">
            {t("power_k.contextual_actions.module.add_remove_members")}
          </Dialog.Title>
          <ModuleMembers module={current} onBusy={setBusy} />
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {t("close")}
          </Button>
        </div>
      </ModalCore>
    );
  if (selected.operation === "status")
    return <ModuleStatusDialog module={current} expectedUpdatedAt={selected.module.updatedAt} onClose={onClose} />;
  return selected.operation === "edit" ? (
    <ModuleFormModal
      projectId={current.projectId}
      module={current}
      snapshot={selected.module}
      onDone={onClose}
      onClose={onClose}
    />
  ) : (
    <ModuleLifecycleDialog
      module={current}
      revision={selected.module.updatedAt}
      operation={selected.operation}
      onClose={onClose}
    />
  );
}

export function ModuleActions({ module, href }: { module: Module; href: string }) {
  const open = useContext(ModuleActionContext);
  if (!open) throw new Error("Module actions require their project route owner.");
  return (
    <>
      <Menu
        render={
          <IconButton variant="tertiary" size="lg" icon={MoreHorizontal} aria-label={`Actions for ${module.name}`} />
        }
      >
        {module.canEdit && <Menu.MenuItem onClick={() => open(module, "edit")}>Edit module</Menu.MenuItem>}
        {module.canWrite &&
          !module.deleted &&
          (module.archived ? (
            <Menu.MenuItem onClick={() => open(module, "unarchive")}>Restore module</Menu.MenuItem>
          ) : (
            <Menu.MenuItem
              disabled={module.status !== "completed" && module.status !== "cancelled"}
              onClick={() => open(module, "archive")}
            >
              Archive module
            </Menu.MenuItem>
          ))}
        {module.canDelete && (
          <Menu.MenuItem onClick={() => open(module, module.deleted ? "restore" : "delete")}>
            {module.deleted ? "Restore deleted module" : "Delete module"}
          </Menu.MenuItem>
        )}
        <Menu.MenuItem onClick={() => open(module, "copy")}>Copy link</Menu.MenuItem>
        <Menu.MenuItem onClick={() => window.open(href, "_blank", "noopener,noreferrer")}>
          Open in new tab
        </Menu.MenuItem>
      </Menu>
    </>
  );
}

export function ModuleContextCommands({
  projectId,
  moduleId,
  close,
}: {
  projectId: Id<"projects">;
  moduleId: string;
  close: () => void;
}) {
  const { t } = useTranslation();
  const module = useQuery(api.modules.index.address, { projectId, moduleId });
  const open = useContext(ModuleActionContext);
  if (!open) throw new Error("Module commands require their project route owner.");
  if (!module) return null;
  return (
    <>
      {module.canEdit && (
        <>
          <PowerKModalCommandItem
            icon={Users}
            label={t("power_k.contextual_actions.module.add_remove_members")}
            onSelect={() => {
              close();
              open(module, "members");
            }}
          />
          <PowerKModalCommandItem
            iconNode={<ModuleStatusIcon status={module.status} className="size-3.5" />}
            label={t("power_k.contextual_actions.module.change_status")}
            onSelect={() => {
              close();
              open(module, "status");
            }}
          />
        </>
      )}
      {!module.deleted && (
        <FavoriteToggle
          workspaceId={module.workspaceId}
          target={{ type: "module", id: module._id }}
          render={(state, toggle, pending) => (
            <PowerKModalCommandItem
              icon={state.isFavorite ? StarOff : Star}
              label={t(
                state.isFavorite
                  ? "power_k.contextual_actions.module.remove_from_favorites"
                  : "power_k.contextual_actions.module.add_to_favorites"
              )}
              isDisabled={pending || state.blockedByFolder}
              onSelect={() => {
                close();
                void toggle();
              }}
            />
          )}
        />
      )}
      <PowerKModalCommandItem
        icon={LinkIcon}
        label={t("power_k.contextual_actions.module.copy_url")}
        onSelect={() => {
          close();
          open(module, "copy");
        }}
      />
    </>
  );
}

export function ModuleLifecycleDialog({
  module,
  revision,
  operation,
  onClose,
}: {
  module: Module;
  revision?: number;
  operation: Operation;
  onClose: () => void;
}) {
  const [expectedUpdatedAt] = useState(revision ?? module.updatedAt);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const save = useMutation(api.modules.index.lifecycle);
  useReloadConfirmations(pending, "The module action is still being saved.", onClose, pending);
  const allowed =
    module.canWrite && (operation === "delete" || operation === "restore" ? module.canDelete : !module.deleted);
  return (
    <ModalCore
      isOpen
      handleClose={() => {
        if (!pending) onClose();
      }}
    >
      <div className="space-y-4 p-6">
        <Dialog.Title className="text-20 font-medium">{lifecycleLabels[operation]}</Dialog.Title>
        <Dialog.Description className="text-14 text-secondary">
          {operation === "delete"
            ? `Delete “${module.name}”? Work items remain in the project. You can recover the module from Trash.`
            : operation === "restore"
              ? `Restore “${module.name}” with its remaining members, links and work items? Its name must be available.`
              : operation === "archive"
                ? `Archive “${module.name}”? You can restore it from archived modules.`
                : `Restore “${module.name}” to project modules?`}
        </Dialog.Description>
        {!allowed && (
          <p role="alert" className="text-14 text-secondary">
            Your access changed. Close this dialog and check the project.
          </p>
        )}
        {error && (
          <p role="alert" className="text-14 text-danger-primary">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={operation === "delete" ? "error-fill" : "primary"}
            disabled={!allowed}
            loading={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await save({ moduleId: module._id, expectedUpdatedAt, operation });
                onClose();
              } catch (failure) {
                setError(mutationMessage(failure));
              } finally {
                setPending(false);
              }
            }}
          >
            {lifecycleLabels[operation]}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
}

export function ModuleUnavailable({ onBack }: { onBack: () => void }) {
  return (
    <section className="space-y-3">
      <h2 className="text-20 font-semibold">This module is unavailable</h2>
      <p role="alert" className="text-14 text-secondary">
        Check the project and your current access.
      </p>
      <Button variant="secondary" onClick={onBack}>
        Back to modules
      </Button>
    </section>
  );
}
export class ModuleBoundary extends Component<
  { children: ReactNode; onBack: () => void; unavailable?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed
      ? (this.props.unavailable ?? <ModuleUnavailable onBack={this.props.onBack} />)
      : this.props.children;
  }
}
