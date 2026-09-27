import { Component, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../commercial/forms";
import { ModuleForm } from "./forms";
import { ModuleTasks } from "./tasks";
import { ModuleMembers } from "./members";
import { TaskRichEditor } from "../tasks/rich-editor";
type Project = FunctionReturnType<typeof api.projects.index.list>[number];
type Module = FunctionReturnType<typeof api.modules.index.get>;
export function Modules({ project }: { project: Project }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("projectModule");
  const deleted = params.get("moduleView") === "trash";
  const modules = usePaginatedQuery(api.modules.index.list, selected ? "skip" : { projectId: project._id, deleted }, {
    initialNumItems: 30,
  });
  const [creating, setCreating] = useState(false);
  const canWrite = project.membershipRole !== "guest" && project.workspaceRole !== "guest";
  const select = (id: Id<"modules"> | null) => {
    setCreating(false);
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (id) next.set("projectModule", id);
      else next.delete("projectModule");
      return next;
    });
  };
  if (creating && canWrite)
    return <ModuleForm projectId={project._id} module={null} onDone={select} onCancel={() => setCreating(false)} />;
  if (selected)
    return (
      <ModuleBoundary key={selected} onBack={() => select(null)}>
        <ModuleDetail moduleId={selected} project={project} onBack={() => select(null)} />
      </ModuleBoundary>
    );
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-24 font-semibold">Modules</h2>
        {canWrite && !deleted && <Button onClick={() => setCreating(true)}>New module</Button>}
      </header>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Module views" className="flex gap-2">
          <Button
            variant={!deleted ? "primary" : "secondary"}
            onClick={() =>
              setParams((current) => {
                const next = new URLSearchParams(current);
                next.delete("moduleView");
                return next;
              })
            }
          >
            Modules
          </Button>
          <Button
            variant={deleted ? "primary" : "secondary"}
            onClick={() =>
              setParams((current) => {
                const next = new URLSearchParams(current);
                next.set("moduleView", "trash");
                return next;
              })
            }
          >
            Trash
          </Button>
        </nav>
      </div>
      <ul className="divide-y divide-subtle-1">
        {modules.results.map((module) => (
          <li key={module._id}>
            <button
              className="flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left"
              onClick={() => select(module._id)}
            >
              <div className="min-w-0">
                <h3 className="text-16 font-medium break-words">{module.name}</h3>
                <p className="text-12 text-secondary">
                  {module.startDate ?? "No start date"} → {module.targetDate ?? "No target date"}
                </p>
              </div>
              <span className="text-12 text-secondary capitalize">
                {module.status.replace("-", " ")}
                {module.archived ? " · archived" : ""}
                {module.deleted ? " · deleted" : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {modules.status === "LoadingFirstPage" && <p role="status">Loading modules…</p>}
      {modules.status === "Exhausted" && !modules.results.length && (
        <p className="py-8 text-center text-14 text-secondary">{deleted ? "No deleted modules." : "No modules yet."}</p>
      )}
      {modules.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => modules.loadMore(30)}>
          Load more modules
        </Button>
      )}
    </section>
  );
}
function ModuleDetail({ moduleId, project, onBack }: { moduleId: string; project: Project; onBack: () => void }) {
  const module = useQuery(api.modules.index.resolve, { moduleId });
  const [editing, setEditing] = useState(false);
  if (!module) return <p role="status">Opening module…</p>;
  if (module.projectId !== project._id) return <Unavailable onBack={onBack} />;
  if (editing && module.canWrite)
    return (
      <ModuleForm
        projectId={project._id}
        module={module}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  return (
    <article className="space-y-5">
      <header className="flex flex-wrap justify-between gap-2">
        <Button variant="secondary" onClick={onBack}>
          Back to modules
        </Button>
        <div className="flex flex-wrap gap-2">
          {module.canEdit && <Button onClick={() => setEditing(true)}>Edit module</Button>}
        </div>
      </header>
      <div>
        <h2 className="text-24 font-semibold break-words">{module.name}</h2>
        <p className="mt-2 text-14 text-secondary capitalize">
          {module.status.replace("-", " ")}
          {module.archived ? " · archived" : ""}
          {module.deleted ? " · deleted" : ""}
        </p>
      </div>
      <dl className="grid gap-3 text-14 sm:grid-cols-3">
        <div>
          <dt className="text-12 text-secondary">Start date</dt>
          <dd>{module.startDate ?? "Not scheduled"}</dd>
        </div>
        <div>
          <dt className="text-12 text-secondary">Target date</dt>
          <dd>{module.targetDate ?? "Not scheduled"}</dd>
        </div>
        <div>
          <dt className="text-12 text-secondary">Lead</dt>
          <dd>{module.lead ? (module.lead.name ?? module.lead.email ?? "Unnamed member") : "No lead"}</dd>
        </div>
      </dl>
      {module.description.trim() && (
        <TaskRichEditor
          key={module.updatedAt}
          id={`module-description-${module._id}`}
          label="Module description"
          placeholder="Describe the module…"
          html={module.descriptionHtml}
          editable={false}
        />
      )}
      <Lifecycle module={module} />
      {!module.deleted && (
        <>
          <ModuleMembers module={module} />
          <ModuleTasks module={module} />
        </>
      )}
    </article>
  );
}
function Lifecycle({ module }: { module: Module }) {
  const lifecycle = useMutation(api.modules.index.lifecycle);
  const [confirmation, setConfirmation] = useState<{
    operation: FunctionArgs<typeof api.modules.index.lifecycle>["operation"];
    expectedUpdatedAt: number;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!module.canWrite) return null;
  const choose = (operation: FunctionArgs<typeof api.modules.index.lifecycle>["operation"]) => {
    setError("");
    setConfirmation({ operation, expectedUpdatedAt: module.updatedAt });
  };
  return (
    <section className="space-y-3 border-b border-subtle-1 pb-4">
      {confirmation ? (
        <div className="space-y-3">
          <p className="text-14">
            {confirmation.operation === "delete"
              ? "Move this module to Trash? Assigned tasks remain in the project."
              : confirmation.operation === "restore"
                ? "Restore this module and its task links? Its name must still be available in this project."
                : `${confirmation.operation === "archive" ? "Archive" : "Unarchive"} this module?`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await lifecycle({ moduleId: module._id, ...confirmation });
                  setConfirmation(null);
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Confirm {confirmation.operation}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setConfirmation(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {module.deleted ? (
            module.canDelete && (
              <Button variant="secondary" onClick={() => choose("restore")}>
                Restore module
              </Button>
            )
          ) : (
            <>
              {module.archived ? (
                <Button variant="secondary" onClick={() => choose("unarchive")}>
                  Unarchive module
                </Button>
              ) : (
                (module.status === "completed" || module.status === "cancelled") && (
                  <Button variant="secondary" onClick={() => choose("archive")}>
                    Archive module
                  </Button>
                )
              )}
              {module.canDelete && (
                <Button variant="secondary" onClick={() => choose("delete")}>
                  Move module to Trash
                </Button>
              )}
            </>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
function Unavailable({ onBack }: { onBack: () => void }) {
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
class ModuleBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Unavailable onBack={this.props.onBack} /> : this.props.children;
  }
}
