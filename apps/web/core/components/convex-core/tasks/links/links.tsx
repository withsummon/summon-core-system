import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@summon/convex/api";
import type { Id } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../../commercial/forms";
import { linkEditDraft } from "./draft";
type Link = FunctionReturnType<typeof api.tasks.links.get>;
export function TaskLinks({ taskId }: { taskId: Id<"tasks"> }) {
  const access = useQuery(api.tasks.links.access, { taskId });
  const [deleted, setDeleted] = useState(false);
  const [editing, setEditing] = useState<Link | "new" | null>(null);
  const links = usePaginatedQuery(
    api.tasks.links.list,
    { taskId, deleted: deleted && access?.canWrite === true },
    { initialNumItems: 20 }
  );
  return (
    <section aria-label="Task links" className="space-y-3 border-t border-subtle-1 pt-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-16 font-semibold">Links</h3>
        <div className="flex gap-2">
          {access?.canWrite && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setDeleted(!deleted);
                setEditing(null);
              }}
            >
              {deleted ? "Active links" : "Removed links"}
            </Button>
          )}
          {access?.canWrite && !deleted && (
            <Button size="sm" onClick={() => setEditing("new")}>
              Add link
            </Button>
          )}
        </div>
      </header>
      {editing !== null && access?.canWrite && (
        <LinkForm
          key={editing === "new" ? "new" : editing._id}
          taskId={taskId}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ul className="space-y-3">
        {links.results.map((link) => (
          <LinkRow
            key={`${link._id}:${deleted}`}
            taskId={taskId}
            link={link}
            canWrite={access?.canWrite === true}
            onEdit={() => setEditing(link)}
          />
        ))}
      </ul>
      {links.status === "LoadingFirstPage" && <p role="status">Loading links…</p>}
      {links.status === "Exhausted" && !links.results.length && (
        <p className="text-14 text-secondary">{deleted ? "No removed links." : "No links yet."}</p>
      )}
      {links.status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => links.loadMore(20)}>
          Load more links
        </Button>
      )}
    </section>
  );
}
function LinkForm({ taskId, initial, onClose }: { taskId: Id<"tasks">; initial: Link | null; onClose: () => void }) {
  const create = useMutation(api.tasks.links.create),
    update = useMutation(api.tasks.links.update);
  const [snapshot] = useState(() => (initial ? linkEditDraft(initial) : null));
  const [url, setUrl] = useState(initial?.url ?? ""),
    [title, setTitle] = useState(initial?.title ?? "");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="space-y-3 rounded-md border border-subtle-1 p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          if (snapshot)
            await update({
              taskId,
              linkId: snapshot.linkId,
              expectedUpdatedAt: snapshot.expectedUpdatedAt,
              url,
              title: title || null,
            });
          else await create({ taskId, url, title: title || null });
          onClose();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="space-y-3">
        <SummonField label="Link URL">
          <Input
            inputMode="url"
            required
            maxLength={2048}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </SummonField>
        <SummonField label="Link title (optional)">
          <Input maxLength={255} value={title} onChange={(event) => setTitle(event.target.value)} />
        </SummonField>
        <div className="flex gap-2">
          <Button type="submit" loading={pending}>
            Save link
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-14 text-danger-primary">
          {error}
        </p>
      )}
    </form>
  );
}
function LinkRow({
  taskId,
  link,
  canWrite,
  onEdit,
}: {
  taskId: Id<"tasks">;
  link: Link;
  canWrite: boolean;
  onEdit: () => void;
}) {
  const lifecycle = useMutation(api.tasks.links.lifecycle);
  const [snapshot, setSnapshot] = useState<Link | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <li className="space-y-2 rounded-md border border-subtle-1 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 text-14 break-all text-accent-primary underline"
        >
          {link.title || link.url}
        </a>
        {canWrite && (
          <div className="flex gap-2">
            {link.deletedAt === null && (
              <Button variant="secondary" size="sm" onClick={onEdit}>
                Edit link
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSnapshot(link);
                setError("");
              }}
            >
              {link.deletedAt === null ? "Remove link" : "Restore link"}
            </Button>
          </div>
        )}
      </div>
      {snapshot && canWrite && (
        <div className="space-y-2">
          <p className="text-14 break-words">
            {snapshot.deletedAt === null ? "Remove" : "Restore"} {snapshot.title || snapshot.url}?
          </p>
          <div className="flex gap-2">
            <Button
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await lifecycle({
                    taskId,
                    linkId: snapshot._id,
                    expectedUpdatedAt: snapshot.updatedAt,
                    deleted: snapshot.deletedAt === null,
                  });
                  setSnapshot(null);
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Confirm {snapshot.deletedAt === null ? "removal" : "restore"}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setSnapshot(null)}>
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
    </li>
  );
}
