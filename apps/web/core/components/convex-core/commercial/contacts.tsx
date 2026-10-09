import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@summon/convex/api";
import type { Doc } from "@summon/convex/data-model";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { SummonField } from "@/components/summon/forms";
import { cardClass, DeleteRecord, field, mutationMessage } from "./forms";

export function Contacts({ client, canWrite }: { client: Doc<"clients">; canWrite: boolean }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.commercial.contacts.list,
    { workspaceId: client.workspaceId, clientId: client._id },
    { initialNumItems: 25 }
  );
  const remove = useMutation(api.commercial.contacts.remove);
  const [editor, setEditor] = useState<{ contact: Doc<"clientContacts"> | null } | null>(null);
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Contacts</h2>
        {canWrite && (
          <Button
            onClick={() => {
              setEditor({ contact: null });
            }}
          >
            Add contact
          </Button>
        )}
      </div>
      {status === "LoadingFirstPage" && <p role="status">Loading contacts…</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {results.map((contact) => (
          <article key={contact._id} className={cardClass}>
            <h3 className="font-medium">
              {contact.name}
              {contact.isPrimary && <span className="text-xs ml-2 text-accent-primary">Primary</span>}
            </h3>
            <p className="text-sm text-secondary">{contact.title}</p>
            <p className="text-sm mt-2 break-all">{contact.email}</p>
            <p className="text-sm">{contact.phone}</p>
            {canWrite && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditor({ contact });
                  }}
                >
                  Edit contact
                </Button>
                <DeleteRecord
                  label="contact"
                  onDelete={async () => {
                    await remove({ workspaceId: client.workspaceId, clientId: client._id, contactId: contact._id });
                    if (editor?.contact?._id === contact._id) setEditor(null);
                  }}
                />
              </div>
            )}
          </article>
        ))}
      </div>
      {status === "Exhausted" && !results.length && <p className="text-sm text-secondary">No contacts added yet.</p>}
      {status === "CanLoadMore" && (
        <Button variant="secondary" onClick={() => loadMore(25)}>
          Load more contacts
        </Button>
      )}
      {canWrite && editor && (
        <ContactForm
          key={editor.contact?._id ?? "new"}
          client={client}
          contact={editor.contact}
          onDone={() => {
            setEditor(null);
          }}
        />
      )}
    </section>
  );
}
function ContactForm({
  client,
  contact,
  onDone,
}: {
  client: Doc<"clients">;
  contact: Doc<"clientContacts"> | null;
  onDone: () => void;
}) {
  const save = useMutation(api.commercial.contacts.save);
  const initial = contact ?? { name: "", title: "", email: "", phone: "", isPrimary: false };
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className={`${cardClass} grid gap-3 sm:grid-cols-2`}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError("");
        try {
          await save({
            workspaceId: client.workspaceId,
            clientId: client._id,
            contactId: contact?._id,
            data: {
              name: field(form, "name"),
              title: field(form, "title"),
              email: field(form, "email"),
              phone: field(form, "phone"),
              isPrimary: form.get("isPrimary") === "on",
            },
          });
          onDone();
        } catch (failure) {
          setError(mutationMessage(failure));
        } finally {
          setPending(false);
        }
      }}
    >
      <h3 className="font-medium sm:col-span-2">{contact ? "Edit contact" : "Add contact"}</h3>
      <SummonField label="Contact name">
        <Input name="name" defaultValue={initial.name} required maxLength={255} />
      </SummonField>
      <SummonField label="Job title">
        <Input name="title" defaultValue={initial.title} maxLength={120} />
      </SummonField>
      <SummonField label="Contact email">
        <Input type="email" name="email" defaultValue={initial.email} maxLength={254} />
      </SummonField>
      <SummonField label="Contact phone">
        <Input name="phone" defaultValue={initial.phone} maxLength={40} />
      </SummonField>
      <label className="text-sm flex items-center gap-2 sm:col-span-2">
        <input name="isPrimary" type="checkbox" defaultChecked={initial.isPrimary} />
        Primary contact
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger-primary sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={pending}>
          Save contact
        </Button>
        <Button variant="secondary" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
