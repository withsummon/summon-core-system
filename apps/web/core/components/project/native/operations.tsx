import { useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { mutationMessage } from "@/components/convex-core/commercial/forms";
import { ArchiveRestoreDialog } from "../archive-restore-modal";
import { DeleteProjectDialog } from "../delete-project-modal";
import { JoinProjectDialog } from "../join-project-modal";

type Project = FunctionReturnType<typeof api.projects.network.get>;
type DeletedProject = FunctionReturnType<typeof api.projects.lifecycle.list>["page"][number];
export type ProjectOperation =
  | { kind: "join" | "restore" | "delete"; project: Project }
  | { kind: "recover"; project: DeletedProject };

function operationAccess(
  selection: ProjectOperation,
  projects: readonly Project[],
  projectsComplete: boolean,
  deletedProjects: readonly DeletedProject[],
  deletedComplete: boolean
) {
  if (selection.kind === "recover")
    return {
      ready: deletedComplete,
      allowed: deletedProjects.some((project) => project.id === selection.project.id),
    };
  const live = projects.find((project) => project.projectId === selection.project.projectId);
  switch (selection.kind) {
    case "join":
      return { ready: projectsComplete, allowed: live?.canJoin === true };
    case "restore":
      return { ready: projectsComplete, allowed: live?.canRestore === true };
    case "delete":
      return { ready: projectsComplete, allowed: live?.canDelete === true };
  }
}

export function NativeProjectOperations({
  selection,
  projects,
  projectsComplete,
  deletedProjects,
  deletedComplete,
  workspaceSlug,
  onClose,
}: {
  selection: ProjectOperation;
  projects: readonly Project[];
  projectsComplete: boolean;
  deletedProjects: readonly DeletedProject[];
  deletedComplete: boolean;
  workspaceSlug: string;
  onClose: () => void;
}) {
  const { ready, allowed } = operationAccess(selection, projects, projectsComplete, deletedProjects, deletedComplete);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const join = useMutation(api.projects.network.join);
  const archive = useMutation(api.projects.settings.setArchived);
  const lifecycle = useMutation(api.projects.lifecycle.setDeleted);
  const navigate = useNavigate();
  const release = useReloadConfirmations(true, "This project action has not been completed.", onClose, pending);
  const close = () => {
    if (!pending) finish();
  };
  const finish = () => {
    onClose();
    release();
  };
  const status = ready
    ? allowed
      ? undefined
      : "This action is no longer available. Your confirmation is preserved; close it and reopen the project's current entry."
    : "Checking project access…";
  async function submit() {
    if (!allowed || !ready || pending) return;
    setPending(true);
    setError("");
    try {
      switch (selection.kind) {
        case "join":
          await join({ projectId: selection.project.projectId, expectedRevision: selection.project.revision });
          onClose();
          release((allowDefaultNavigation) => {
            if (allowDefaultNavigation) navigate(`/${workspaceSlug}/projects/${selection.project.projectId}/issues`);
          });
          break;
        case "restore":
          await archive({
            projectId: selection.project.projectId,
            expectedRevision: selection.project.revision,
            archived: false,
          });
          finish();
          break;
        case "delete":
          await lifecycle({
            projectId: selection.project.projectId,
            expectedRevision: selection.project.revision,
            deleted: true,
          });
          break;
        case "recover":
          await lifecycle({
            projectId: selection.project.id,
            expectedRevision: selection.project.revision,
            deleted: false,
          });
          finish();
          break;
      }
    } catch (failure) {
      if (selection.kind === "delete") throw failure;
      setError(mutationMessage(failure));
    } finally {
      setPending(false);
    }
  }
  if (selection.kind === "delete")
    return (
      <DeleteProjectDialog
        isOpen
        name={selection.project.name}
        recoverable
        pending={pending}
        canSubmit={allowed && ready}
        statusMessage={status}
        onClose={close}
        onDone={finish}
        onDelete={submit}
      />
    );
  if (selection.kind === "join")
    return (
      <JoinProjectDialog
        isOpen
        name={selection.project.name}
        loading={pending}
        canJoin={allowed && ready}
        error={error || status}
        handleClose={close}
        onJoin={() => void submit()}
      />
    );
  return (
    <ArchiveRestoreDialog
      isOpen
      name={selection.project.name}
      archive={false}
      loading={pending}
      canConfirm={allowed && ready}
      error={error || status}
      onClose={close}
      onConfirm={() => void submit()}
      description={
        selection.kind === "recover"
          ? selection.project.archived
            ? "This project will return to Archived projects. Its archived status will be preserved."
            : "This project will return to Projects with its retained data."
          : undefined
      }
    />
  );
}
