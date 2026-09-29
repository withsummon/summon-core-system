import useReloadConfirmations from "@/hooks/use-reload-confirmation";
import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Doc } from "@summon/convex/data-model";
import { api } from "@summon/convex/api";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { Dialog } from "@plane/propel/dialog";
import { ModalCore } from "@plane/ui";
import { SummonField } from "@/components/summon/forms";
import { mutationMessage } from "../commercial/forms";
type Module = FunctionReturnType<typeof api.modules.index.get>;
export function ModuleLinks({ module }: { module: Module }) {
  const links = usePaginatedQuery(api.modules.links.list, module.deleted ? "skip" : { moduleId: module._id }, {
    initialNumItems: 20,
  });
  const [editing, setEditing] = useState<Doc<"moduleLinks"> | null | undefined>(),
    [removing, setRemoving] = useState<Doc<"moduleLinks"> | null>(null);
  return (
    <section
      aria-label="Module links"
      className="space-y-3 border-t border-subtle-1 pt-4"
      hidden={module.deleted && editing === undefined && removing === null}
    >
      {!module.deleted && (
        <>
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-14 font-medium">Links</h3>
            {module.canEdit && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                Add module link
              </Button>
            )}
          </header>
          <ul className="space-y-3">
            {links.results.map((link) => (
              <li key={link._id} className="flex flex-wrap items-center justify-between gap-2">
                <a
                  className="min-w-0 text-14 break-all text-accent-primary"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.title || link.url}
                </a>
                {module.canEdit && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(link)}>
                      Edit link
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRemoving(link)}>
                      Remove link
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {links.status === "LoadingFirstPage" && <p role="status">Loading links…</p>}
          {links.status === "Exhausted" && !links.results.length && (
            <p className="text-14 text-secondary">No links yet.</p>
          )}
          {links.status === "CanLoadMore" && (
            <Button variant="secondary" onClick={() => links.loadMore(20)}>
              Load more module links
            </Button>
          )}
        </>
      )}
      {editing !== undefined && (
        <LinkForm key={editing?._id ?? "new"} module={module} initial={editing} onClose={() => setEditing(undefined)} />
      )}
      {removing && <RemoveLink key={removing._id} module={module} link={removing} onClose={() => setRemoving(null)} />}
    </section>
  );
}
function LinkForm({
  module,
  initial,
  onClose,
}: {
  module: Module;
  initial: Doc<"moduleLinks"> | null;
  onClose: () => void;
}) {
  const [snapshot] = useState(initial),
    [url, setUrl] = useState(initial?.url ?? ""),
    [title, setTitle] = useState(initial?.title ?? ""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const create = useMutation(api.modules.links.create),
    update = useMutation(api.modules.links.update);
  useReloadConfirmations(
    url !== (snapshot?.url ?? "") || title !== (snapshot?.title ?? "") || pending,
    "This module link has unsaved changes.",
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
          if (!module.canEdit || pending) return;
          setPending(true);
          setError("");
          try {
            const content = { moduleId: module._id, url, title: title || null, metadata: snapshot?.metadata ?? {} };
            if (snapshot) await update({ ...content, linkId: snapshot._id, expectedUpdatedAt: snapshot.updatedAt });
            else await create(content);
            onClose();
          } catch (failure) {
            setError(mutationMessage(failure));
          } finally {
            setPending(false);
          }
        }}
      >
        <Dialog.Title className="text-18 font-medium">{snapshot ? "Edit module link" : "Add module link"}</Dialog.Title>
        <fieldset disabled={pending || !module.canEdit} className="space-y-3">
          <SummonField label="Link title" htmlFor="module-link-title">
            <Input
              id="module-link-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={255}
            />
          </SummonField>
          <SummonField label="URL" htmlFor="module-link-url">
            <Input
              id="module-link-url"
              inputMode="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
            />
          </SummonField>
          <Button type="submit" loading={pending}>
            Save module link
          </Button>
        </fieldset>
        <Button variant="secondary" disabled={pending} onClick={onClose}>
          Cancel
        </Button>
        {!module.canEdit && <p className="text-14 text-secondary">This module is read-only. Your draft is retained.</p>}
        {error && (
          <p role="alert" className="text-14 text-danger-primary">
            {error}
          </p>
        )}
      </form>
    </ModalCore>
  );
}
function RemoveLink({ module, link, onClose }: { module: Module; link: Doc<"moduleLinks">; onClose: () => void }) {
  const [snapshot] = useState(link),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const remove = useMutation(api.modules.links.remove);
  useReloadConfirmations(pending, "The module link is still being removed.", onClose, pending);
  return (
    <ModalCore
      isOpen
      handleClose={() => {
        if (!pending) onClose();
      }}
    >
      <div className="space-y-4 p-5">
        <Dialog.Title className="text-18 font-medium">Remove module link</Dialog.Title>
        <p className="text-14 break-all">Remove {snapshot.title || snapshot.url}? This link cannot be restored here.</p>
        <div className="flex gap-2">
          <Button
            disabled={!module.canEdit}
            loading={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await remove({ moduleId: module._id, linkId: snapshot._id, expectedUpdatedAt: snapshot.updatedAt });
                onClose();
              } catch (failure) {
                setError(mutationMessage(failure));
              } finally {
                setPending(false);
              }
            }}
          >
            Confirm removal
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
      </div>
    </ModalCore>
  );
}
