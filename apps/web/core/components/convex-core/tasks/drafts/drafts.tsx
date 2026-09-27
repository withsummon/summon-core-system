import { DraftEstimate } from "../../estimates/selection";
import { Component, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { mutationMessage } from "../../commercial/forms";
import { TaskRichEditor } from "../rich-editor";
import { DraftAttachments } from "./draft-attachments";
import { DraftForm } from "./form";
type Workspace = FunctionReturnType<typeof api.workspaces.index.list>[number];
type Draft = FunctionReturnType<typeof api.tasks.drafts.index.resolve>;
export function TaskDrafts({ workspace }: { workspace: Workspace }) {
  const [params, setParams] = useSearchParams();
  const selected = params.get("draft"),
    deleted = params.get("draftView") === "trash";
  const notes = usePaginatedQuery(
    api.tasks.drafts.index.list,
    selected ? "skip" : { workspaceId: workspace._id, deleted },
    { initialNumItems: 30 }
  );
  const create = useMutation(api.tasks.drafts.index.create);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const open = (id: Id<"taskDrafts">, edit = false) =>
    setParams({
      workspace: workspace.slug,
      module: "tasks",
      taskSection: "drafts",
      draft: id,
      ...(edit ? { draftEdit: "true" } : {}),
    });
  const back = (trash = deleted) =>
    setParams({
      workspace: workspace.slug,
      module: "tasks",
      taskSection: "drafts",
      ...(trash ? { draftView: "trash" } : {}),
    });
  if (selected)
    return (
      <DraftBoundary key={selected} onBack={() => back()}>
        <DraftDetail
          workspace={workspace}
          draftId={selected}
          initialEditing={params.get("draftEdit") === "true"}
          onBack={back}
          onCopy={open}
        />
      </DraftBoundary>
    );
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-12 text-secondary">{workspace.name} · Only you</p>
          <h1 className="text-28 font-semibold">Task drafts</h1>
        </div>
        <Button
          loading={pending}
          onClick={async () => {
            setPending(true);
            setError("");
            try {
              open(await create({ workspaceId: workspace._id }), true);
            } catch (failure) {
              setError(mutationMessage(failure));
            } finally {
              setPending(false);
            }
          }}
        >
          Create draft
        </Button>
      </header>
      <nav aria-label="Task draft views" className="flex flex-wrap gap-2 border-b border-subtle-1 pb-3">
        <Button variant="secondary" onClick={() => setParams({ workspace: workspace.slug, module: "tasks" })}>
          Tasks
        </Button>
        <Button variant={!deleted ? "primary" : "secondary"} onClick={() => back(false)}>
          Drafts
        </Button>
        <Button variant={deleted ? "primary" : "secondary"} onClick={() => back(true)}>
          Trash
        </Button>
      </nav>
      <ul className="divide-y divide-subtle-1">
        {notes.results.map((draft) => (
          <li key={draft._id}>
            <button className="block w-full space-y-1 py-4 text-left" onClick={() => open(draft._id)}>
              <h2 className="text-16 font-medium break-words">{draft.title || "Untitled draft"}</h2>
              <p className="line-clamp-2 text-14 text-secondary">{draft.description || "No description"}</p>
              <p className="text-12 text-secondary">Updated {new Date(draft.updatedAt).toLocaleString()}</p>
            </button>
          </li>
        ))}
      </ul>
      {notes.status === "LoadingFirstPage" && <p role="status">Loading task drafts…</p>}
      {notes.status === "Exhausted" && !notes.results.length && (
        <p className="py-8 text-center text-14 text-secondary">
          {deleted ? "No removed drafts." : "Create a private draft before publishing it to a project."}
        </p>
      )}
      {notes.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => notes.loadMore(30)}>
          Load more drafts
        </Button>
      )}
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </section>
  );
}
function DraftDetail({
  workspace,
  draftId,
  initialEditing,
  onBack,
  onCopy,
}: {
  workspace: Workspace;
  draftId: string;
  initialEditing: boolean;
  onBack: (trash?: boolean) => void;
  onCopy: (id: Id<"taskDrafts">) => void;
}) {
  const draft = useQuery(api.tasks.drafts.index.resolve, { workspaceId: workspace._id, draftId });
  const [editing, setEditing] = useState(initialEditing);
  const [params, setParams] = useSearchParams();
  const done = () => {
    setEditing(false);
    const next = new URLSearchParams(params);
    next.delete("draftEdit");
    setParams(next, { replace: true });
  };
  if (!draft) return <p role="status">Opening task draft…</p>;
  const openTask = (taskId: Id<"tasks">, identifier: string) =>
    setParams({ workspace: workspace.slug, module: "tasks", project: identifier, task: taskId });
  const published =
    draft.publishedTaskId && draft.project
      ? { taskId: draft.publishedTaskId, identifier: draft.project.identifier }
      : null;
  return (
    <section className="max-w-4xl space-y-5">
      <div className="space-y-5">
        {editing ? (
          <DraftForm initial={draft} onDone={done} />
        ) : (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="secondary" onClick={() => onBack(draft.deletedAt !== null)}>
                Back to drafts
              </Button>
              {draft.deletedAt === null && !draft.publishedTaskId && (
                <Button onClick={() => setEditing(true)}>Edit draft</Button>
              )}
            </header>
            <div>
              <p className="text-12 text-secondary">
                Only you · {draft.publishedTaskId ? "Published" : draft.deletedAt !== null ? "Trash" : "Unpublished"}
              </p>
              <h1 className="text-28 font-semibold break-words">{draft.title || "Untitled draft"}</h1>
              <p className="mt-2 text-14 text-secondary">{draft.project?.name ?? "No project selected"}</p>
            </div>
            <dl className="grid gap-3 text-14 sm:grid-cols-2">
              <div>
                <dt className="text-12 text-secondary">State</dt>
                <dd>
                  {draft.properties.stateId
                    ? "Selected project state"
                    : (draft.status?.replaceAll("_", " ") ?? "Project default at publication")}
                </dd>
              </div>
              <div>
                <dt className="text-12 text-secondary">Priority</dt>
                <dd>{draft.properties.priority}</dd>
              </div>
              <div>
                <dt className="text-12 text-secondary">Dates</dt>
                <dd>
                  {draft.properties.startDate ?? "No start date"} · {draft.properties.targetDate ?? "No due date"}
                </dd>
              </div>
              <div>
                <dt className="text-12 text-secondary">Saved selections</dt>
                <dd>
                  {draft.properties.assigneeIds.length} assignees · {draft.properties.labelIds.length} labels ·{" "}
                  {draft.modules.length} modules{draft.parent ? " · Parent task" : ""}
                  {draft.cycle ? " · Cycle" : ""}
                </dd>
              </div>
            </dl>
            <DraftEstimate draftId={draft._id} />
            {draft.description.trim() && (
              <TaskRichEditor
                id={`draft-preview-${draft._id}`}
                label="Draft description"
                placeholder="Describe the task…"
                html={draft.html}
                editable={false}
              />
            )}
            {published ? (
              <Button onClick={() => openTask(published.taskId, published.identifier)}>Open published task</Button>
            ) : (
              <DraftActions draft={draft} onCopy={onCopy} onLifecycle={onBack} onPublished={openTask} />
            )}
          </>
        )}
      </div>
      {draft.deletedAt === null && !draft.publishedTaskId && <DraftAttachments key={draft._id} draftId={draft._id} />}
    </section>
  );
}
function DraftActions({
  draft,
  onCopy,
  onLifecycle,
  onPublished,
}: {
  draft: Draft;
  onCopy: (id: Id<"taskDrafts">) => void;
  onLifecycle: (trash: boolean) => void;
  onPublished: (id: Id<"tasks">, identifier: string) => void;
}) {
  const copy = useAction(api.tasks.drafts.copy.run),
    lifecycle = useMutation(api.tasks.drafts.index.lifecycle),
    publish = useMutation(api.tasks.drafts.index.publish);
  const [confirmation, setConfirmation] = useState<{
    kind: "publish" | "remove" | "restore" | "copy";
    snapshot: Draft;
  } | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="space-y-3 border-t border-subtle-1 pt-4">
      <div className="flex flex-wrap gap-2">
        {draft.deletedAt === null ? (
          <>
            <Button
              disabled={pending || !draft.canPublish}
              onClick={() => setConfirmation({ kind: "publish", snapshot: draft })}
            >
              Publish task
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setConfirmation({ kind: "copy", snapshot: draft })}
            >
              Make a copy
            </Button>
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setConfirmation({ kind: "remove", snapshot: draft })}
            >
              Move to Trash
            </Button>
          </>
        ) : (
          <Button disabled={pending} onClick={() => setConfirmation({ kind: "restore", snapshot: draft })}>
            Restore draft
          </Button>
        )}
      </div>
      {confirmation && (
        <div className="space-y-3 rounded-lg border border-subtle-1 p-4">
          <p className="text-14">
            {confirmation.kind === "publish"
              ? `Publish “${confirmation.snapshot.title || "Untitled draft"}” to ${confirmation.snapshot.project?.name}? This creates a project task with the saved properties and relationships.`
              : confirmation.kind === "copy"
                ? "Copy this private draft and its ready files? Removed files are not copied."
                : confirmation.kind === "remove"
                  ? "Move this private draft to Trash? You can restore it later."
                  : "Restore this draft to your private collection?"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                const args = { draftId: confirmation.snapshot._id, expectedUpdatedAt: confirmation.snapshot.updatedAt };
                try {
                  if (confirmation.kind === "publish") {
                    const result = await publish(args);
                    onPublished(result.taskId, result.identifier);
                  } else if (confirmation.kind === "copy") {
                    onCopy(await copy(args));
                  } else {
                    const deleted = confirmation.kind === "remove";
                    await lifecycle({ ...args, deleted });
                    onLifecycle(deleted);
                  }
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Confirm {confirmation.kind === "remove" ? "move to Trash" : confirmation.kind}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setConfirmation(null)}>
              Cancel
            </Button>
          </div>
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
class DraftBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="space-y-3">
        <h2 className="text-20 font-semibold">This draft is unavailable</h2>
        <p className="text-14 text-secondary">
          It may belong to another account, or its project is no longer accessible.
        </p>
        <Button variant="secondary" onClick={this.props.onBack}>
          Back to drafts
        </Button>
      </section>
    ) : (
      this.props.children
    );
  }
}
