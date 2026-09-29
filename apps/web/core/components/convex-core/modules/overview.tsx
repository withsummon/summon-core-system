import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import { Link } from "react-router";
import { Dialog } from "@plane/propel/dialog";
import { IconButton } from "@plane/propel/icon-button";
import { CloseIcon } from "@plane/propel/icons";
import { ModuleProperties } from "./properties";
import { ModuleMembers } from "./members";
import { ModuleLinks } from "./links";
import { ModuleProgress } from "./progress";
import { ModuleActions } from "./actions";
import { ModuleBoundary } from "./actions";
import { TaskRichEditor } from "../tasks/rich-editor";
import { FavoriteToggle } from "../favorites/toggle";
type Address = FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
type Module = FunctionReturnType<typeof api.modules.index.get>;

export function ModuleOverview({
  address,
  moduleId,
  onClose,
}: {
  address: Address;
  moduleId: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Panel className="!top-0 !right-0 !left-auto !h-dvh !max-h-dvh !w-full !max-w-[560px] !translate-x-0 !translate-y-0 overflow-auto !rounded-none">
        <ModuleBoundary key={moduleId} onBack={onClose}>
          <OverviewContent address={address} moduleId={moduleId} onClose={onClose} />
        </ModuleBoundary>
      </Dialog.Panel>
    </Dialog>
  );
}

function OverviewContent({ address, moduleId, onClose }: { address: Address; moduleId: string; onClose: () => void }) {
  const module = useQuery(api.modules.index.address, { projectId: address.project._id, moduleId });
  if (module === undefined)
    return (
      <p role="status" className="p-6">
        Loading module…
      </p>
    );
  if (module === null)
    return (
      <p role="alert" className="p-6">
        This module is unavailable in this project.
      </p>
    );
  const href = `/${address.workspace.slug}/projects/${module.projectId}/modules/${module._id}/`;
  return (
    <>
      <header className="flex min-h-11 items-center justify-between gap-2 border-b border-subtle px-4">
        <IconButton icon={CloseIcon} variant="ghost" aria-label="Close module overview" onClick={onClose} />
        <Link to={href} className="text-13 text-secondary">
          Open module
        </Link>
        <ModuleActions module={module} href={href} />
      </header>
      <div className="space-y-5 p-6">
        <Dialog.Title className="text-20 font-semibold break-words">{module.name}</Dialog.Title>
        <ModuleSummary module={module} />
      </div>
    </>
  );
}

export function ModuleSummary({ module }: { module: Module }) {
  return (
    <div className="space-y-5">
      {module.description && (
        <TaskRichEditor
          id={`module-description-${module._id}`}
          label="Module description"
          html={module.descriptionHtml}
          placeholder="Description"
          editable={false}
        />
      )}
      {module.archived && <p className="text-13 text-secondary">This module is archived.</p>}
      {module.deleted && <p className="text-13 text-secondary">This module is in Trash.</p>}
      {!module.deleted && (
        <FavoriteToggle workspaceId={module.workspaceId} target={{ type: "module", id: module._id }} />
      )}
      <ModuleProperties module={module} />
      <ModuleMembers module={module} />
      {module.canWrite && !module.deleted && <ModuleProgress moduleId={module._id} />}
      <ModuleLinks module={module} />
    </div>
  );
}
