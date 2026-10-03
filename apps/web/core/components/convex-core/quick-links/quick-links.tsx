import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { Doc, Id } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
type QuickLink = Doc<"quickLinks">;
export function QuickLinks({ workspaceId }: { workspaceId: Id<"workspaces"> }) {
  const links = usePaginatedQuery(api.quickLinks.index.list, { workspaceId }, { initialNumItems: 10 });
  const [editing, setEditing] = useState<"new" | QuickLink | null>(null);
  return (
    <section aria-label="Personal quick links" className="mt-5 space-y-3 border-t border-subtle-1 pt-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-12 font-semibold text-secondary">QUICK LINKS</h2>
        <Button size="sm" variant="secondary" aria-label="Add quick link" onClick={() => setEditing("new")}>
          Add
        </Button>
      </header>
      <p className="text-12 text-secondary">Only you can see these links.</p>
      {editing !== null && (
        <LinkForm
          key={editing === "new" ? "new" : editing._id}
          workspaceId={workspaceId}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <nav aria-label="Your quick links">
        <ul className="space-y-3">
          {links.results.map((link) => (
            <LinkRow key={link._id} link={link} onEdit={() => setEditing(link)} />
          ))}
        </ul>
      </nav>
      {links.status === "LoadingFirstPage" && (
        <p role="status" className="text-12 text-secondary">
          Loading quick links…
        </p>
      )}
      {links.status === "Exhausted" && !links.results.length && (
        <p className="text-12 text-secondary">Save a link you use often.</p>
      )}
      {links.status === "CanLoadMore" && (
        <Button size="sm" variant="secondary" onClick={() => links.loadMore(10)}>
          Load more links
        </Button>
      )}
    </section>
  );
}
function LinkRow({ link, onEdit }: { link: QuickLink; onEdit: () => void }) {
  const remove = useMutation(api.quickLinks.index.remove);
  const [version, setVersion] = useState<number | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const label = link.title || link.url;
  return (
    <li className="min-w-0 space-y-1">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-14 break-words text-accent-primary hover:underline"
      >
        {label}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      {version === null ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" aria-label={`Edit quick link ${label}`} onClick={onEdit}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="secondary"
            aria-label={`Remove quick link ${label}`}
            onClick={() => {
              setError("");
              setVersion(link.updatedAt);
            }}
          >
            Remove
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-12 text-secondary">Remove this quick link?</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  await remove({ workspaceId: link.workspaceId, linkId: link._id, expectedUpdatedAt: version });
                } catch (failure) {
                  setError(mutationMessage(failure));
                } finally {
                  setPending(false);
                }
              }}
            >
              Confirm remove
            </Button>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => setVersion(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
    </li>
  );
}
function LinkForm({
  workspaceId,
  initial,
  onClose,
}: {
  workspaceId: Id<"workspaces">;
  initial: QuickLink | null;
  onClose: () => void;
}) {
  const create = useMutation(api.quickLinks.index.create),
    update = useMutation(api.quickLinks.index.update);
  const [snapshot] = useState(initial);
  const [title, setTitle] = useState(initial?.title ?? ""),
    [url, setUrl] = useState(initial?.url ?? "");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="space-y-3 rounded-lg border border-subtle-1 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        try {
          const fields = { workspaceId, title: title || null, url };
          if (snapshot) await update({ ...fields, linkId: snapshot._id, expectedUpdatedAt: snapshot.updatedAt });
          else await create(fields);
          onClose();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <h3 className="text-14 font-medium">{snapshot ? "Edit quick link" : "Add quick link"}</h3>
      <SummonField label="Link URL">
        <Input
          required
          inputMode="url"
          maxLength={2048}
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full"
        />
      </SummonField>
      <p className="text-12 text-secondary">HTTP and HTTPS links only. Addresses without a scheme use HTTP.</p>
      <SummonField label="Link title (optional)">
        <Input maxLength={255} value={title} onChange={(e) => setTitle(e.target.value)} className="w-full" />
      </SummonField>
      {error && (
        <p role="alert" className="text-12 text-danger-primary">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="submit" loading={pending}>
          Save link
        </Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
