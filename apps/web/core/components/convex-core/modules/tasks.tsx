import useReloadConfirmations, { useReloadSubmitting } from "@/hooks/use-reload-confirmation";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import { api } from "@summon/convex/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { ModalCore } from "@plane/ui";
import { ProjectViewLayoutRoot } from "@/components/issues/issue-layouts/roots/project-view-layout-root";
import { TaskPreferencesControls } from "../../../../app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/issues/(list)/header";
import { mutationMessage } from "../commercial/forms";
type Module = FunctionReturnType<typeof api.modules.index.get>;
type Address = FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
type Task = FunctionReturnType<typeof api.tasks.index.list>["page"][number];
type Remove = FunctionArgs<typeof api.modules.tasks.set>;

export function ModuleTasks({ module, address }: { module: Module; address: Address }) {
  const preferences = useQuery(
    api.modules.index.getTaskPreferences,
    module.deleted ? "skip" : { moduleId: module._id }
  );
  const savePreferences = useMutation(api.modules.index.saveTaskPreferences);
  const busy = useReloadSubmitting();
  const tasks = usePaginatedQuery(
    api.modules.tasks.list,
    !module.deleted && preferences
      ? {
          moduleId: module._id,
          filters: preferences.filters,
          order: preferences.displayFilters.order,
          includeSubtasks: preferences.displayFilters.includeSubtasks,
        }
      : "skip",
    { initialNumItems: 50 }
  );
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<Remove | null>(null);
  return (
    <section className="flex min-h-0 flex-col" hidden={module.deleted && !assigning && !removing}>
      {!module.deleted && (
        <>
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle px-page-x py-3">
            <h3 className="text-14 font-medium">Work items</h3>
            <div className="flex flex-wrap items-center gap-2">
              <TaskPreferencesControls
                key={module._id}
                projectId={module.projectId}
                preferences={preferences}
                onApply={(changes) => savePreferences({ moduleId: module._id, ...changes })}
              />
              {module.canEdit && (
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => setAssigning(true)}>
                  Add existing work items
                </Button>
              )}
            </div>
          </header>
          {preferences && (
            <ProjectViewLayoutRoot
              tasks={tasks.results.flatMap((row) => (row.task ? [row.task] : []))}
              address={address}
              displayFilters={preferences.displayFilters}
              displayProperties={preferences.displayProperties}
              cohortComplete={tasks.status === "Exhausted"}
              taskActions={(task) => (Item) =>
                module.canEdit && (
                  <Item
                    disabled={busy}
                    onClick={() =>
                      setRemoving({
                        moduleId: module._id,
                        taskId: task._id,
                        assigned: false,
                        expectedTaskUpdatedAt: task.updatedAt,
                        expectedModuleUpdatedAt: module.updatedAt,
                      })
                    }
                  >
                    Remove from module
                  </Item>
                )
              }
            />
          )}
          <ul className="divide-y divide-subtle">
            {tasks.results
              .filter((row) => row.task === null)
              .map((row) => (
                <li key={row.taskId} className="flex flex-wrap items-center justify-between gap-2 px-page-x py-3">
                  <span className="text-14 text-secondary">Work item unavailable</span>
                  {module.canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        setRemoving({
                          moduleId: module._id,
                          taskId: row.taskId,
                          assigned: false,
                          expectedTaskUpdatedAt: row.updatedAt,
                          expectedModuleUpdatedAt: module.updatedAt,
                        })
                      }
                    >
                      Remove from module
                    </Button>
                  )}
                </li>
              ))}
          </ul>
          {(!preferences || tasks.status === "LoadingFirstPage") && (
            <p role="status" className="p-6">
              Loading module work items…
            </p>
          )}
          {tasks.status === "Exhausted" && !tasks.results.length && (
            <p className="p-6 text-14 text-secondary">No work items in this module.</p>
          )}
          {tasks.status === "CanLoadMore" && (
            <Button className="m-4 self-start" variant="secondary" onClick={() => tasks.loadMore(50)}>
              Load more work items
            </Button>
          )}
          {tasks.status === "LoadingMore" && (
            <p role="status" className="p-4">
              Loading more work items…
            </p>
          )}
        </>
      )}
      {assigning && <LinkTasks module={module} onClose={() => setAssigning(false)} />}
      {removing && <RemoveTask snapshot={removing} module={module} onClose={() => setRemoving(null)} />}
    </section>
  );
}

function LinkTasks({ module, onClose }: { module: Module; onClose: () => void }) {
  const [initial] = useState(module);
  const tasks = usePaginatedQuery(api.tasks.index.list, { projectId: module.projectId }, { initialNumItems: 50 });
  const [selected, setSelected] = useState<Task[]>([]);
  const assign = useMutation(api.modules.tasks.setMany);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useReloadConfirmations(
    selected.length > 0 || pending,
    "This module has unsaved work item selections.",
    onClose,
    pending
  );
  return (
    <ModalCore
      isOpen
      handleClose={() => {
        if (!pending) onClose();
      }}
    >
      <form
        className="space-y-4 p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!selected.length || !module.canEdit || pending) return;
          setPending(true);
          setError("");
          try {
            await assign({
              moduleId: initial._id,
              expectedModuleUpdatedAt: initial.updatedAt,
              assigned: true,
              tasks: selected.map((task) => ({ taskId: task._id, expectedTaskUpdatedAt: task.updatedAt })),
            });
            onClose();
          } catch (failure) {
            setError(mutationMessage(failure));
          } finally {
            setPending(false);
          }
        }}
      >
        <Dialog.Title className="text-18 font-medium">Add existing work items</Dialog.Title>
        <ul className="max-h-80 space-y-2 overflow-auto">
          {tasks.results.map((task) => (
            <li key={task._id}>
              <label className="flex cursor-pointer items-start gap-2 text-14">
                <input
                  type="checkbox"
                  disabled={pending || !module.canEdit}
                  checked={selected.some((item) => item._id === task._id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked ? [...selected, task] : selected.filter((item) => item._id !== task._id)
                    )
                  }
                />
                <span className="min-w-0 break-words">{task.title}</span>
              </label>
            </li>
          ))}
        </ul>
        {tasks.status === "LoadingFirstPage" && <p role="status">Loading work items…</p>}
        {tasks.status === "CanLoadMore" && (
          <Button variant="ghost" size="sm" onClick={() => tasks.loadMore(50)}>
            Load more work items
          </Button>
        )}
        {!module.canEdit && (
          <p className="text-14 text-secondary">This module is read-only. Your selection is retained.</p>
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
          <Button type="submit" disabled={!selected.length || !module.canEdit} loading={pending}>
            Add selected work items
          </Button>
        </div>
      </form>
    </ModalCore>
  );
}

function RemoveTask({ snapshot, module, onClose }: { snapshot: Remove; module: Module; onClose: () => void }) {
  const remove = useMutation(api.modules.tasks.set);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useReloadConfirmations(pending, "The module work item is still being removed.", onClose, pending);
  return (
    <ModalCore
      isOpen
      handleClose={() => {
        if (!pending) onClose();
      }}
    >
      <div className="space-y-4 p-5">
        <Dialog.Title className="text-18 font-medium">Remove from module</Dialog.Title>
        <Dialog.Description className="text-14 text-secondary">
          This work item stays in the project and its other modules.
        </Dialog.Description>
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
            loading={pending}
            disabled={!module.canEdit}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await remove(snapshot);
                onClose();
              } catch (failure) {
                setError(mutationMessage(failure));
              } finally {
                setPending(false);
              }
            }}
          >
            Remove from module
          </Button>
        </div>
      </div>
    </ModalCore>
  );
}
