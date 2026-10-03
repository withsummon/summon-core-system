import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery } from "convex-helpers/react";
import { useSearchParams } from "react-router";
import { api } from "@summon/convex/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Button } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { ModalCore } from "@plane/ui";
import { calculateIdentifierWidth } from "@/components/issues/issue-layouts/utils";
import { ProjectIssueRow } from "../tasks/lifecycle";
import { taskStatusOptions } from "../tasks/options";
import { mutationMessage } from "../commercial/forms";
type Module = FunctionReturnType<typeof api.modules.index.get>;
type Address = FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
type Task = FunctionReturnType<typeof api.tasks.index.list>["page"][number];
type Relation = FunctionReturnType<typeof api.modules.tasks.list>["page"][number];
type Remove = FunctionArgs<typeof api.modules.tasks.set>;

export function ModuleTasks({ module, address }: { module: Module; address?: Address }) {
  const tasks = usePaginatedQuery(api.modules.tasks.list, module.deleted ? "skip" : { moduleId: module._id }, {
    initialNumItems: 50,
  });
  const states = useQuery(api.tasks.states.list, { projectId: module.projectId });
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<Remove | null>(null);
  const [, setParams] = useSearchParams();
  const identity = address?.project;
  return (
    <section className="flex min-h-0 flex-col" hidden={module.deleted && !assigning && !removing}>
      {!module.deleted && (
        <>
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle px-page-x py-3">
            <h3 className="text-14 font-medium">Work items</h3>
            {module.canEdit && (
              <Button variant="secondary" size="sm" onClick={() => setAssigning(true)}>
                Add existing work items
              </Button>
            )}
          </header>
          <ul className="divide-y divide-subtle">
            {tasks.results.map((row) => (
              <ModuleTaskRow
                key={row.taskId}
                row={row}
                module={module}
                address={address}
                identifier={identity ? identity.identifier + "-" + row.task?.sequence : ""}
                identifierWidth={
                  identity ? calculateIdentifierWidth(identity.identifier.length, identity.nextSequence) : 80
                }
                stateName={
                  row.task
                    ? (states?.find((state) => state._id === row.task?.stateId)?.name ??
                      taskStatusOptions[row.task.status].label)
                    : ""
                }
                onRemove={() =>
                  setRemoving({
                    moduleId: module._id,
                    taskId: row.taskId,
                    assigned: false,
                    expectedTaskUpdatedAt: row.updatedAt,
                    expectedModuleUpdatedAt: module.updatedAt,
                  })
                }
                onOpen={() =>
                  setParams((current) => {
                    const next = new URLSearchParams(current);
                    next.set("projectView", "tasks");
                    next.delete("taskView");
                    next.delete("projectModule");
                    next.delete("comment");
                    next.set("task", row.taskId);
                    return next;
                  })
                }
              />
            ))}
          </ul>
          {tasks.status === "LoadingFirstPage" && (
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

function ModuleTaskRow({
  row,
  module,
  address,
  identifier,
  identifierWidth,
  stateName,
  onOpen,
  onRemove,
}: {
  row: Relation;
  module: Module;
  address?: Address;
  identifier: string;
  identifierWidth: number;
  stateName: string;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      {row.task && address ? (
        <ProjectIssueRow
          task={row.task}
          identifier={identifier}
          identifierWidth={identifierWidth}
          stateName={stateName}
          href={"/" + address.workspace.slug + "/browse/" + identifier + "/"}
        >
          {(Item) => module.canEdit && <Item onClick={onRemove}>Remove from module</Item>}
        </ProjectIssueRow>
      ) : (
        <li className="flex flex-wrap items-center justify-between gap-2 px-page-x py-3">
          {row.task ? (
            <button className="min-w-0 text-left text-14 break-words hover:text-accent-primary" onClick={onOpen}>
              {row.task.title}
            </button>
          ) : (
            <span className="text-14 text-secondary">Work item unavailable</span>
          )}
          {module.canEdit && (
            <Button variant="ghost" size="sm" onClick={onRemove}>
              Remove from module
            </Button>
          )}
        </li>
      )}
    </>
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
