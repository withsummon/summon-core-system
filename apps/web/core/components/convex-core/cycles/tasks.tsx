import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { usePaginatedQuery as useTaskPages } from "convex-helpers/react";
import { Dialog, EDialogWidth } from "@plane/propel/dialog";
import { Select } from "@plane/propel/select";
import { Menu } from "@plane/propel/menu";
import { ProjectIssueRow } from "../tasks/lifecycle";
import { TaskPeek, CreateProjectIssue } from "../tasks/task-detail";
import { taskStatusOptions } from "../tasks/options";
import { calculateIdentifierWidth } from "@/components/issues/issue-layouts/utils";
import useKeypress from "@/hooks/use-keypress";
import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { api } from "@summon/convex/api";
import type { Doc, Id } from "@summon/convex/data-model";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@plane/propel/button";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
import { useCycleClock } from "./use-cycle-clock";
type Cycle = NonNullable<FunctionReturnType<typeof api.cycles.index.address>>;
type Membership = FunctionReturnType<typeof api.cycles.tasks.list>["page"][number];
export function CycleTasks({
  cycle,
  address,
}: {
  cycle: Cycle;
  address: FunctionReturnType<typeof api.navigation.address.resolveProjectId>;
}) {
  const [now] = useCycleClock();
  const capabilities = useQuery(api.cycles.index.get, { cycleId: cycle._id, now });
  const canEdit = capabilities?.canEdit === true;
  const tasks = useTaskPages(api.cycles.tasks.list, cycle.deleted ? "skip" : { cycleId: cycle._id }, {
    initialNumItems: 50,
  });
  const states = useQuery(api.tasks.states.list, { projectId: cycle.projectId });
  const [assigning, setAssigning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Membership | null>(null);
  const [moving, setMoving] = useState<NonNullable<Membership["task"]> | null>(null);
  useKeypress("c", (event) => {
    if (!canEdit || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("input, textarea, select, [contenteditable], [role=dialog]")
    )
      return;
    event.preventDefault();
    setCreating(true);
  });
  return (
    <section className="h-full min-w-0" hidden={cycle.deleted}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle px-5 py-2">
        <h2 className="text-13 font-medium">Work items</h2>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAssigning(true)}>
              Add existing work item
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              Add work item
            </Button>
          </div>
        )}
      </header>
      {assigning && <AssignTask cycle={cycle} canEdit={canEdit} onClose={() => setAssigning(false)} />}
      <ul className="divide-y divide-subtle">
        {tasks.results.map((row) =>
          row.task ? (
            <ProjectIssueRow
              key={row.taskId}
              task={row.task}
              identifier={`${address.project.identifier}-${row.task.sequence}`}
              identifierWidth={calculateIdentifierWidth(
                address.project.identifier.length,
                address.project.nextSequence
              )}
              href={`/${address.workspace.slug}/browse/${address.project.identifier}-${row.task.sequence}/`}
              stateName={
                states?.find((state) => state._id === row.task?.stateId)?.name ??
                taskStatusOptions[row.task.status].label
              }
            >
              <Menu.MenuItem disabled={!canEdit} onClick={() => setMoving(row.task)}>
                Move to another cycle
              </Menu.MenuItem>
              <Menu.MenuItem disabled={!canEdit} onClick={() => setRemoving(row)}>
                Remove from cycle
              </Menu.MenuItem>
            </ProjectIssueRow>
          ) : (
            <li key={row.taskId} className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="text-13 text-secondary">Work item unavailable</span>
              <Button variant="secondary" size="sm" disabled={!canEdit} onClick={() => setRemoving(row)}>
                Remove from cycle
              </Button>
            </li>
          )
        )}
      </ul>
      {tasks.status === "LoadingFirstPage" && (
        <p role="status" className="p-5">
          Loading cycle work items…
        </p>
      )}
      {tasks.status === "Exhausted" && !tasks.results.length && (
        <p className="p-6 text-center text-13 text-secondary">No work items in this cycle.</p>
      )}
      {tasks.status === "CanLoadMore" && (
        <Button variant="secondary" className="m-4" onClick={() => tasks.loadMore(50)}>
          Load more work items
        </Button>
      )}
      {tasks.status === "LoadingMore" && (
        <p role="status" className="p-4">
          Loading more work items…
        </p>
      )}
      <TaskPeek workspaceSlug={address.workspace.slug} />
      {removing && (
        <RemoveTask
          key={removing.taskId}
          taskId={removing.taskId}
          updatedAt={removing.updatedAt}
          cycle={cycle}
          canEdit={canEdit}
          onClose={() => setRemoving(null)}
        />
      )}
      {moving && (
        <MoveCycleTask key={moving._id} task={moving} cycle={cycle} canEdit={canEdit} onClose={() => setMoving(null)} />
      )}
      {creating && states && (
        <CreateProjectIssue
          address={address}
          states={states}
          canCreate={canEdit}
          initialValues={{ cycle: { cycleId: cycle._id, expectedCycleUpdatedAt: cycle.updatedAt } }}
          onClose={() => setCreating(false)}
        />
      )}
    </section>
  );
}
function AssignTask({ cycle, canEdit, onClose }: { cycle: Cycle; canEdit: boolean; onClose: () => void }) {
  const [initial] = useState(cycle);
  const tasks = useTaskPages(api.tasks.index.list, { projectId: cycle.projectId }, { initialNumItems: 50 });
  const [selected, setSelected] = useState<Doc<"tasks"> | null>(null);
  const current = useQuery(api.cycles.tasks.current, selected && canEdit ? { taskId: selected._id } : "skip");
  const assign = useMutation(api.cycles.tasks.assign);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const release = useReloadConfirmations(pending, "The work item assignment is still being saved.", onClose);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <Dialog.Panel width={EDialogWidth.XXL}>
        <div className="p-5">
          <Dialog.Title className="mb-4">Add work item to cycle</Dialog.Title>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!canEdit || !selected || current === undefined) return;
              setPending(true);
              setError("");
              try {
                await assign({
                  cycleId: initial._id,
                  expectedCycleUpdatedAt: initial.updatedAt,
                  taskId: selected._id,
                  expectedTaskUpdatedAt: selected.updatedAt,
                });
                release(onClose);
              } catch (failure) {
                setError(mutationMessage(failure));
              } finally {
                setPending(false);
              }
            }}
          >
            <SummonField label="Task" htmlFor="cycle-task">
              <Select
                id="cycle-task"
                required
                placeholder="Choose work item"
                value={selected?._id ?? ""}
                disabled={pending}
                options={tasks.results.map((task) => ({ value: task._id, label: task.title }))}
                onValueChange={(value) => setSelected(tasks.results.find((task) => task._id === value) ?? null)}
              />
            </SummonField>
            {selected && current === undefined && <p role="status">Loading current cycle membership…</p>}
            {current && (
              <p className="text-14 text-secondary">Currently in {current.name}. Assignment moves it to this cycle.</p>
            )}
            {!canEdit && (
              <p role="status" className="text-13 text-secondary">
                Saving is unavailable. Your selection is preserved.
              </p>
            )}
            {tasks.status === "CanLoadMore" && (
              <Button variant="secondary" onClick={() => tasks.loadMore(50)}>
                Load more project tasks
              </Button>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={pending} disabled={!canEdit || !selected || current === undefined}>
                Confirm assignment
              </Button>
              <Button variant="secondary" disabled={pending} onClick={onClose}>
                Cancel
              </Button>
            </div>
            {error && (
              <p role="alert" className="text-14 text-danger-primary">
                {error}
              </p>
            )}
          </form>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
function RemoveTask({
  taskId,
  updatedAt,
  cycle,
  canEdit,
  onClose,
}: {
  taskId: Id<"tasks">;
  updatedAt: number;
  cycle: Cycle;
  canEdit: boolean;
  onClose: () => void;
}) {
  const remove = useMutation(api.cycles.tasks.remove);
  const [snapshot] = useState({ taskVersion: updatedAt, cycleVersion: cycle.updatedAt });
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const release = useReloadConfirmations(pending, "The work item removal is still being saved.", onClose);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <Dialog.Panel width={EDialogWidth.MD}>
        <div className="space-y-4 p-5">
          <Dialog.Title>Remove work item from cycle?</Dialog.Title>
          <Dialog.Description className="text-13 text-secondary">
            The work item stays in the project.
          </Dialog.Description>
          {!canEdit && (
            <p role="status" className="text-13 text-secondary">
              This cycle can no longer be changed.
            </p>
          )}
          {error && (
            <p role="alert" className="text-13 text-danger-primary">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={pending}
              disabled={!canEdit}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await remove({
                    taskId,
                    cycleId: cycle._id,
                    expectedTaskUpdatedAt: snapshot.taskVersion,
                    expectedCycleUpdatedAt: snapshot.cycleVersion,
                  });
                  release(onClose);
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Remove from cycle
            </Button>
          </div>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}

function MoveCycleTask({
  task,
  cycle,
  canEdit,
  onClose,
}: {
  task: NonNullable<Membership["task"]>;
  cycle: Cycle;
  canEdit: boolean;
  onClose: () => void;
}) {
  const [initial] = useState(task);
  const [now] = useCycleClock();
  const [queryClock] = useState(Date.now);
  const choices = useTaskPages(
    api.cycles.index.browse,
    {
      projectId: cycle.projectId,
      view: "all",
      now: queryClock,
      phases: ["draft", "upcoming", "current"],
      search: "",
      startDate: null,
      endDate: null,
    },
    { initialNumItems: 30 }
  );
  const [destination, setDestination] = useState<Cycle | null>(null);
  const destinationCapabilities = useQuery(
    api.cycles.index.get,
    destination ? { cycleId: destination._id, now } : "skip"
  );
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const assign = useMutation(api.cycles.tasks.assign);
  const eligible = choices.results.filter((row) => row._id !== cycle._id && row.canEdit);
  const enabled =
    canEdit &&
    destinationCapabilities?.canEdit === true &&
    destination !== null &&
    eligible.some((row) => row._id === destination._id);
  const release = useReloadConfirmations(pending, "The work item move is still being saved.", onClose);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <Dialog.Panel width={EDialogWidth.MD}>
        <div className="space-y-4 p-5">
          <Dialog.Title>Move work item to another cycle</Dialog.Title>
          <p className="text-13 break-words">{initial.title}</p>
          <SummonField label="Destination cycle" htmlFor="cycle-move-destination">
            <Select
              id="cycle-move-destination"
              value={destination?._id ?? ""}
              placeholder="Choose cycle"
              disabled={pending}
              options={eligible.map((row) => ({ value: row._id, label: row.name }))}
              onValueChange={(value) => setDestination(eligible.find((row) => row._id === value) ?? null)}
            />
          </SummonField>
          {choices.status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => choices.loadMore(30)}>
              Load more cycles
            </Button>
          )}
          {error && (
            <p role="alert" className="text-13 text-danger-primary">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={pending}
              disabled={!enabled}
              onClick={async () => {
                if (!enabled || !destination) return;
                setPending(true);
                setError("");
                try {
                  await assign({
                    cycleId: destination._id,
                    expectedCycleUpdatedAt: destination.updatedAt,
                    taskId: initial._id,
                    expectedTaskUpdatedAt: initial.updatedAt,
                  });
                  release(onClose);
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Move work item
            </Button>
          </div>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
}
